CREATE INDEX `CartItem_cartId_idx` ON `CartItem`(`cartId`);

CREATE INDEX `CartItem_cartId_productId_productVariantId_idx` ON `CartItem`(`cartId`, `productId`, `productVariantId`);
