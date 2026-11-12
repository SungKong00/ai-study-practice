package com.example.shop.product;

public record ProductResponse(Long id, String name, long price) {

    static ProductResponse from(Product product) {
        return new ProductResponse(product.getId(), product.getName(), product.getPrice());
    }
}
