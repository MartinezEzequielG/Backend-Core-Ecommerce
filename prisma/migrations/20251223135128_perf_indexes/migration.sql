-- CreateIndex
CREATE INDEX `Cart_sessionToken_idx` ON `Cart`(`sessionToken`);

-- CreateIndex
CREATE INDEX `Order_userId_createdAt_idx` ON `Order`(`userId`, `createdAt`);

-- CreateIndex
CREATE INDEX `Order_status_createdAt_idx` ON `Order`(`status`, `createdAt`);

-- CreateIndex
CREATE INDEX `Product_active_createdAt_idx` ON `Product`(`active`, `createdAt`);

-- CreateIndex
CREATE INDEX `Product_categoryId_active_createdAt_idx` ON `Product`(`categoryId`, `active`, `createdAt`);

-- CreateIndex
CREATE INDEX `ProductVariant_productId_active_idx` ON `ProductVariant`(`productId`, `active`);

-- CreateIndex
CREATE INDEX `ProductVariant_productId_stock_idx` ON `ProductVariant`(`productId`, `stock`);

-- RenameIndex
ALTER TABLE `cart` RENAME INDEX `Cart_userId_fkey` TO `Cart_userId_idx`;
