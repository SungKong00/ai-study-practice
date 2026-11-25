import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from bot import Finding, RequestBot, RoutedFinding, render, thread_stage


class DialogueTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.path = "ProductService.java"
        self.source = ("a" * 40, "b" * 40, "기본은 id 오름차순이다.",
                       {self.path: "return products.findAllByOrderByIdAsc();"})
        self.thread = Mock(id=123, jump_url="https://discord.com/channels/1/123")
        self.thread.name = "상품 정렬"
        self.finding = Finding(kind="supported", answer="ID순으로 조회합니다.", spec_quote="id 오름차순",
                               code_file=self.path, code_quote="products.findAllByOrderByIdAsc()",
                               title="정렬 옵션", problem="가격을 비교하기 어렵다.", behavior="가격순 조회", example="100원 상품이 200원 상품보다 먼저 보인다.")

    def test_support_requires_both_sources_and_creates_no_draft(self):
        text, draft = render(self.finding, self.source, self.thread, "정렬?")
        self.assertIn(self.path, text)
        self.assertIsNone(draft)
        for wrong in ({"spec_quote": "없는 정책"}, {"code_quote": "없는 쿼리"}):
            text, draft = render(self.finding.model_copy(update=wrong), self.source, self.thread, "정렬?")
            self.assertIn("개발자의 확인", text)
            self.assertIsNone(draft)

    def test_unresolved_decisions_only_ask_a_question(self):
        question = self.finding.model_copy(update={"kind":"ask", "answer":"같은 가격은 ID순으로 할까요?"})
        self.assertEqual(render(question, self.source, self.thread, "가격순"), (question.answer, None))

    async def test_followup_uses_prior_question_and_stages_without_approving(self):
        author = SimpleNamespace(id=10, bot=False)
        bot_user = SimpleNamespace(id=20, bot=True)
        def msg(id, user, content):
            return SimpleNamespace(id=id, channel=self.thread, author=user, webhook_id=None, content=content)
        async def history(**kwargs):
            yield msg(2, bot_user, "**요구사항 구체화**\n동률은 어떻게 할까요?")
            yield msg(1, author, "가격순으로 보고 싶어요.")
        self.thread.history = history
        bot = Mock(user=bot_user, ref="HEAD")
        bot.review = AsyncMock(side_effect=[{"state":"missing"}, {"state":"pending"}])
        bot.show = AsyncMock()
        response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(
            parsed=RoutedFinding(**{**self.finding.model_dump(), "kind":"draft"}, intent="change")))])
        bot.api.chat.completions.parse = AsyncMock(return_value=response)
        with patch("bot.snapshot", return_value=self.source):
            await RequestBot.handle(bot, msg(3, author, "기존 기본값 유지, 동률이면 ID순으로요."))
        bot.api.chat.completions.parse.assert_awaited_once()
        self.assertEqual(bot.api.chat.completions.parse.call_args.kwargs["reasoning_effort"], "medium")
        calls = bot.api.chat.completions.parse.call_args.kwargs["messages"]
        self.assertEqual([m["content"] for m in calls[-3:]],
                         ["가격순으로 보고 싶어요.", "**요구사항 구체화**\n동률은 어떻게 할까요?", "기존 기본값 유지, 동률이면 ID순으로요."])
        args = bot.review.await_args_list[-1]
        self.assertEqual(args.args[1], "draft")
        expected = ("## 무엇이 불편한가\n\n가격을 비교하기 어렵다.\n\n## 어떤 동작을 원하는가\n\n가격순 조회"
                    "\n\n## 완료됐다고 볼 예시\n\n100원 상품이 200원 상품보다 먼저 보인다.")
        self.assertTrue(args.kwargs["body"].startswith(expected + "\n\n구현 근거"))
        self.assertIn(self.thread.jump_url, args.kwargs["body"])

    def test_draft_uses_template_order_and_rejects_missing_fields(self):
        draft = self.finding.model_copy(update={"kind": "draft"})
        with patch("bot.ISSUE_TEMPLATE") as template:
            template.read_text.return_value = "---\nname: 실습\n---\n## 사례\n<!-- example -->\n<!-- behavior -->\n<!-- problem -->"
            _, row = render(draft, self.source, self.thread, "가격순")
            self.assertTrue(row["body"].startswith("## 사례\n" + draft.example))
            with self.assertRaises(ValueError):
                render(draft.model_copy(update={"example": " "}), self.source, self.thread, "가격순")
            template.read_text.return_value = template.read_text.return_value.replace("<!-- problem -->", "")
            with self.assertRaises(ValueError):
                render(draft, self.source, self.thread, "가격순")

    async def test_requests_use_only_the_needed_models(self):
        actor = SimpleNamespace(id=10, bot=False)
        async def history(**kwargs):
            for item in []:
                yield item
        self.thread.history = history
        message = SimpleNamespace(id=11, channel=self.thread, author=actor, webhook_id=None, content="상품 질문")
        cases = {"lookup": [("mini", None)], "change": [("mini", None), ("full", "medium")],
                 "impact": [("mini", None), ("full", "high")]}
        for intent, expected in cases.items():
            with self.subTest(intent=intent):
                bot = Mock(user=SimpleNamespace(id=20), model="mini", reasoning_model="full", ref="HEAD")
                bot.review = AsyncMock(return_value={"state":"missing"})
                finding = RoutedFinding(**self.finding.model_dump(), intent=intent)
                response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(parsed=finding))])
                bot.api.chat.completions.parse = AsyncMock(return_value=response)
                self.thread.send = AsyncMock()
                with patch("bot.snapshot", return_value=self.source), patch("bot.product_tests", return_value={}) as extra:
                    await RequestBot.handle(bot, message)
                calls = bot.api.chat.completions.parse.await_args_list
                self.assertEqual([(c.kwargs["model"], c.kwargs.get("reasoning_effort")) for c in calls], expected)
                self.assertEqual(extra.call_count, int(intent == "impact"))

    def test_only_bot_reply_can_restore_high_stage(self):
        def marker(author):
            return SimpleNamespace(author=SimpleNamespace(id=author), webhook_id=None, content="**영향 분석**\n확인")
        self.assertEqual(thread_stage([marker(1)], 1), "high")
        self.assertEqual(thread_stage([marker(2)], 1), "lookup")

    async def test_approval_requires_configured_role(self):
        interaction = Mock(data={"custom_id":"approve:token"}, user=Mock(roles=[]))
        interaction.response.send_message = AsyncMock()
        bot = Mock(reviewer=42, review=AsyncMock())
        await RequestBot.on_interaction(bot, interaction)
        bot.review.assert_not_awaited()
        interaction.response.send_message.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
