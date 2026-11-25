package com.example.shop.product;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/products")
public class ProductController {

    private final ProductService products;

    public ProductController(ProductService products) {
        this.products = products;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse create(@Valid @RequestBody CreateProductRequest request) {
        return products.create(request);
    }

    @GetMapping
    public List<ProductResponse> list(@RequestParam MultiValueMap<String, String> params) {
        return products.list(nameFilter(params.get("name")), sortOrder(params.get("sort")));
    }

    private static String nameFilter(List<String> values) {
        if (values == null) {
            return null;
        }
        if (values.size() != 1 || values.getFirst() == null || values.getFirst().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name must be one non-blank value");
        }
        return values.getFirst();
    }

    private static Sort sortOrder(List<String> values) {
        Sort byId = Sort.by("id");
        if (values == null) {
            return byId;
        }
        if (values.size() == 1) {
            return switch (values.getFirst()) {
                case "price,asc" -> Sort.by("price").ascending().and(byId);
                case "price,desc" -> Sort.by("price").descending().and(byId);
                case null, default -> throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "sort must be price,asc or price,desc");
            };
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sort must appear only once");
    }
}
