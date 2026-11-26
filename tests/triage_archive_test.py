"""동일한 기능을 두 PR로 나누는 경우 기준 명세·보관 범위를 확인한다."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


class ArchiveTest(unittest.TestCase):
    def test_independent_price_and_search_changes(self):
        root = Path(__file__).resolve().parents[1]
        relative = Path("openspec/specs/product-catalog/spec.md")
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            spec = work / relative
            spec.parent.mkdir(parents=True)
            spec.write_bytes(subprocess.check_output(["git", "show", "bc5faf2:" + str(relative)], cwd=root))
            for name in ["product-price-sort", "product-name-search"]:
                archived = next((root/"openspec/changes/archive").glob("*-" + name))
                shutil.copytree(archived, work/"openspec/changes"/name)
            def archive(name):
                subprocess.run(["openspec","archive",name,"-y"], cwd=work, capture_output=True, check=True)
            archive("product-price-sort")
            self.assertIn("sort=price,asc", spec.read_text())
            self.assertNotIn("### Requirement: 상품명으로 목록 검색", spec.read_text())
            self.assertTrue((work/"openspec/changes/product-name-search/tasks.md").exists())
            archive("product-name-search")
            self.assertEqual(spec.read_bytes(), subprocess.check_output(["git","show","6aed646:"+str(relative)],cwd=root))
            subprocess.run(["openspec","validate","--all","--strict"], cwd=work, capture_output=True, check=True)
