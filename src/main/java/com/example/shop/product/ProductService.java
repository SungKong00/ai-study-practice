package com.example.shop.product;

import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductService {

    private final ProductRepository products;

    public ProductService(ProductRepository products) {
        this.products = products;
    }

    @Transactional
    public ProductResponse create(CreateProductRequest request) {
        Product product = products.save(new Product(request.name(), request.price()));
        return ProductResponse.from(product);
    }

    @Transactional(readOnly = true)
    public List<ProductResponse> list(String name, Sort sort) {
        List<Product> matches = name == null ? products.findAll(sort) : products.findByName(name, sort);
        return matches.stream()
                .map(ProductResponse::from)
                .toList();
    }
}
