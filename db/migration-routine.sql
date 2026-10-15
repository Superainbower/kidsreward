-- 例程模板（每日任务）功能迁移：在已有数据库上执行一次
ALTER TABLE `TaskTemplate`
  ADD COLUMN `isRoutine` TINYINT(1) NOT NULL DEFAULT 0 AFTER `isActive`;

CREATE TABLE IF NOT EXISTS `TemplateCategory` (
    `id`          VARCHAR(191) NOT NULL,
    `templateId`  VARCHAR(191) NOT NULL,
    `name`        VARCHAR(191) NOT NULL,
    `sortOrder`   INTEGER      NOT NULL DEFAULT 0,
    `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    KEY `TemplateCategory_templateId_idx` (`templateId`),
    CONSTRAINT `TemplateCategory_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `TaskTemplate` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `TemplateSubtask` (
    `id`          VARCHAR(191) NOT NULL,
    `categoryId`  VARCHAR(191) NOT NULL,
    `name`        VARCHAR(191) NOT NULL,
    `points`      INTEGER      NOT NULL DEFAULT 1,
    `choiceGroup` VARCHAR(191) NULL DEFAULT NULL,
    `sortOrder`   INTEGER      NOT NULL DEFAULT 0,
    `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    KEY `TemplateSubtask_categoryId_idx` (`categoryId`),
    CONSTRAINT `TemplateSubtask_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `TemplateCategory` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ChildTemplateAssignment` (
    `childId`     VARCHAR(191) NOT NULL,
    `templateId`  VARCHAR(191) NOT NULL,
    `updatedAt`   DATETIME(3)  NOT NULL,
    PRIMARY KEY (`childId`),
    KEY `ChildTemplateAssignment_templateId_idx` (`templateId`),
    CONSTRAINT `ChildTemplateAssignment_childId_fkey` FOREIGN KEY (`childId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `ChildTemplateAssignment_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `TaskTemplate` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SubtaskCompletion` (
    `id`             VARCHAR(191) NOT NULL,
    `familyId`       VARCHAR(191) NOT NULL,
    `childId`        VARCHAR(191) NOT NULL,
    `subtaskId`      VARCHAR(191) NOT NULL,
    `completedDate`  DATE         NOT NULL,
    `pointsAwarded`  INTEGER      NOT NULL DEFAULT 0,
    `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `SubtaskCompletion_unique_idx` (`childId`, `subtaskId`, `completedDate`),
    KEY `SubtaskCompletion_child_date_idx` (`childId`, `completedDate`),
    CONSTRAINT `SubtaskCompletion_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `SubtaskCompletion_childId_fkey` FOREIGN KEY (`childId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `SubtaskCompletion_subtaskId_fkey` FOREIGN KEY (`subtaskId`) REFERENCES `TemplateSubtask` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
