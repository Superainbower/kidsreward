-- 例程模板第二版迁移：子任务次数、分次进度、每日结算
ALTER TABLE `TemplateSubtask`
  ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 1 AFTER `points`;

ALTER TABLE `SubtaskCompletion`
  ADD COLUMN `progress` INTEGER NOT NULL DEFAULT 1 AFTER `completedDate`;

CREATE TABLE IF NOT EXISTS `RoutineSettlement` (
    `id`           VARCHAR(191) NOT NULL,
    `familyId`     VARCHAR(191) NOT NULL,
    `childId`      VARCHAR(191) NOT NULL,
    `settledDate`  DATE         NOT NULL,
    `points`       INTEGER      NOT NULL DEFAULT 0,
    `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `RoutineSettlement_unique_idx` (`childId`, `settledDate`),
    KEY `RoutineSettlement_family_date_idx` (`familyId`, `settledDate`),
    CONSTRAINT `RoutineSettlement_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `RoutineSettlement_childId_fkey` FOREIGN KEY (`childId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
