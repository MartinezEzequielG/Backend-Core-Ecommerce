-- AlterTable
ALTER TABLE `order` ADD COLUMN `guestSessionToken` VARCHAR(128) NULL;

-- CreateIndex
CREATE INDEX `Order_guestSessionToken_createdAt_idx` ON `Order`(`guestSessionToken`, `createdAt`);

-- CreateIndex
CREATE INDEX `Order_id_guestSessionToken_idx` ON `Order`(`id`, `guestSessionToken`);
