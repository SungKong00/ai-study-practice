package com.example.shop.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ProductApiTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ProductRepository products;

    @BeforeEach
    void clearProducts() {
        products.deleteAll();
    }

    @Test
    void returnsEmptyListWhenNoProductsExist() throws Exception {
        mvc.perform(get("/products"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void registersProductAndReturnsItInTheList() throws Exception {
        long id = register("스터디 노트", 12000);

        mvc.perform(get("/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].name").value("스터디 노트"))
                .andExpect(jsonPath("$[0].price").value(12000));
    }

    @Test
    void acceptsFreeProductAndMaximumNameLengthWithoutTrimming() throws Exception {
        String name = " " + "가".repeat(98) + " ";
        register(name, 0);

        mvc.perform(get("/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value(name))
                .andExpect(jsonPath("$[0].price").value(0));
    }

    @Test
    void acceptsSingleCharacterNameAndMaximumLongPrice() throws Exception {
        register("가", Long.MAX_VALUE);

        mvc.perform(get("/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("가"))
                .andExpect(jsonPath("$[0].price").value(Long.MAX_VALUE));
    }

    @Test
    void listsProductsByUniqueAscendingId() throws Exception {
        long firstId = register("같은 이름", 2000);
        long secondId = register("같은 이름", 1000);
        assertThat(secondId).isGreaterThan(firstId);

        mvc.perform(get("/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id").value(firstId))
                .andExpect(jsonPath("$[0].price").value(2000))
                .andExpect(jsonPath("$[1].id").value(secondId))
                .andExpect(jsonPath("$[1].price").value(1000));
    }

    @ParameterizedTest
    @MethodSource("invalidRequests")
    void rejectsInvalidInputWithoutChangingStoredProducts(String request) throws Exception {
        long existingId = register("기존 상품", 1000);

        mvc.perform(post("/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400));

        assertThat(products.count()).isEqualTo(1);
        mvc.perform(get("/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(existingId))
                .andExpect(jsonPath("$[0].name").value("기존 상품"))
                .andExpect(jsonPath("$[0].price").value(1000));
    }

    static Stream<String> invalidRequests() {
        return Stream.of(
                "{}",
                "{\"price\":1000}",
                "{\"name\":null,\"price\":1000}",
                "{\"name\":\"\",\"price\":1000}",
                "{\"name\":\"   \",\"price\":1000}",
                "{\"name\":\"" + "가".repeat(101) + "\",\"price\":1000}",
                "{\"name\":123,\"price\":1000}",
                "{\"name\":1.5,\"price\":1000}",
                "{\"name\":true,\"price\":1000}",
                "{\"name\":[],\"price\":1000}",
                "{\"name\":\"상품\"}",
                "{\"name\":\"상품\",\"price\":null}",
                "{\"name\":\"상품\",\"price\":-1}",
                "{\"name\":\"상품\",\"price\":1.5}",
                "{\"name\":\"상품\",\"price\":\"1000\"}",
                "{\"name\":\"상품\",\"price\":true}",
                "{\"name\":\"상품\",\"price\":[]}",
                "{\"name\":\"상품\",\"price\":9223372036854775808}",
                "{\"name\":",
                "null",
                "[]");
    }

    private long register(String name, long price) throws Exception {
        String response = mvc.perform(post("/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\",\"price\":" + price + "}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", greaterThan(0)))
                .andExpect(jsonPath("$.name").value(name))
                .andExpect(jsonPath("$.price").value(price))
                .andReturn().getResponse().getContentAsString();
        return JsonPath.<Number>read(response, "$.id").longValue();
    }
}
