-- =============================================================
-- Kids Reward 数据库初始化 DDL
-- 引擎: MySQL 8.x / MariaDB (InnoDB + utf8mb4)
-- 生成时间: 2026-07-28
-- 对应 Prisma Schema: prisma/schema.prisma
-- =============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------
-- 1. Family — 家庭
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Family` (
    `id`        VARCHAR(191) NOT NULL,
    `name`      VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 2. User — 用户（家长 / 小朋友）
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `User` (
    `id`           VARCHAR(191) NOT NULL,
    `familyId`     VARCHAR(191) NOT NULL,
    `name`         VARCHAR(191) NOT NULL,
    `phone`        VARCHAR(191) NULL     DEFAULT NULL,
    `passwordHash` VARCHAR(191) NULL     DEFAULT NULL,
    `role`         VARCHAR(191) NOT NULL DEFAULT 'child',
    `ageGroup`     VARCHAR(191) NULL     DEFAULT NULL,
    `avatarUrl`    VARCHAR(191) NULL     DEFAULT NULL,
    `pinCode`      VARCHAR(191) NULL     DEFAULT NULL,
    `wxOpenid`     VARCHAR(191) NULL     DEFAULT NULL,
    `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`    DATETIME(3)  NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `User_phone_key` (`phone`),
    UNIQUE KEY `User_wxOpenid_key` (`wxOpenid`),
    KEY `User_familyId_fkey` (`familyId`),
    CONSTRAINT `User_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 3. TaskTemplate — 任务模板
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `TaskTemplate` (
    `id`          VARCHAR(191) NOT NULL,
    `familyId`    VARCHAR(191) NOT NULL,
    `title`       VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL     DEFAULT NULL,
    `points`      INTEGER      NOT NULL DEFAULT 1,
    `category`    VARCHAR(191) NOT NULL DEFAULT 'daily',
    `icon`        VARCHAR(191) NOT NULL DEFAULT '⭐',
    `isActive`    TINYINT(1)   NOT NULL DEFAULT 1,
    `isRoutine`   TINYINT(1)   NOT NULL DEFAULT 0,
    `eggEnabled`  TINYINT(1)   NOT NULL DEFAULT 0,
    `eggRewards`  TEXT         NULL,
    `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`   DATETIME(3)  NOT NULL,
    PRIMARY KEY (`id`),
    KEY `TaskTemplate_familyId_fkey` (`familyId`),
    CONSTRAINT `TaskTemplate_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 4. Task — 具体任务实例
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Task` (
    `id`          VARCHAR(191) NOT NULL,
    `familyId`    VARCHAR(191) NOT NULL,
    `templateId`  VARCHAR(191) NULL     DEFAULT NULL,
    `title`       VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL     DEFAULT NULL,
    `points`      INTEGER      NOT NULL DEFAULT 1,
    `type`        VARCHAR(191) NOT NULL DEFAULT 'daily',
    `status`      VARCHAR(191) NOT NULL DEFAULT 'pending',
    `eggRewardType`  VARCHAR(191) NULL DEFAULT NULL,
    `eggRewardValue` VARCHAR(191) NULL DEFAULT NULL,
    `eggRevealedAt`  DATETIME(3)  NULL DEFAULT NULL,
    `assignedTo`  VARCHAR(191) NOT NULL,
    `createdBy`   VARCHAR(191) NOT NULL,
    `dueDate`     DATETIME(3)  NULL     DEFAULT NULL,
    `completedAt` DATETIME(3)  NULL     DEFAULT NULL,
    `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`   DATETIME(3)  NOT NULL,
    PRIMARY KEY (`id`),
    KEY `Task_familyId_status_idx` (`familyId`, `status`),
    KEY `Task_assignedTo_status_idx` (`assignedTo`, `status`),
    KEY `Task_templateId_fkey` (`templateId`),
    KEY `Task_createdBy_fkey` (`createdBy`),
    CONSTRAINT `Task_familyId_fkey`   FOREIGN KEY (`familyId`)   REFERENCES `Family` (`id`)       ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `Task_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `TaskTemplate` (`id`) ON DELETE SET NULL  ON UPDATE CASCADE,
    CONSTRAINT `Task_assignedTo_fkey` FOREIGN KEY (`assignedTo`) REFERENCES `User` (`id`)         ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `Task_createdBy_fkey`  FOREIGN KEY (`createdBy`)  REFERENCES `User` (`id`)         ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 5. PointsTransaction — 积分变动记录
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `PointsTransaction` (
    `id`          VARCHAR(191) NOT NULL,
    `familyId`    VARCHAR(191) NOT NULL,
    `userId`      VARCHAR(191) NOT NULL,
    `amount`      INTEGER      NOT NULL,
    `type`        VARCHAR(191) NOT NULL,
    `reason`      VARCHAR(191) NOT NULL,
    `referenceId` VARCHAR(191) NULL     DEFAULT NULL,
    `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    KEY `PointsTransaction_userId_createdAt_idx` (`userId`, `createdAt`),
    KEY `PointsTransaction_familyId_fkey` (`familyId`),
    CONSTRAINT `PointsTransaction_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `PointsTransaction_userId_fkey`   FOREIGN KEY (`userId`)   REFERENCES `User` (`id`)   ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 6. Reward — 奖品
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Reward` (
    `id`          VARCHAR(191) NOT NULL,
    `familyId`    VARCHAR(191) NOT NULL,
    `title`       VARCHAR(191) NOT NULL,
    `icon`        VARCHAR(191) NOT NULL DEFAULT '🎁',
    `description` VARCHAR(191) NULL     DEFAULT NULL,
    `pointsCost`  INTEGER      NOT NULL,
    `imageUrl`    VARCHAR(191) NULL     DEFAULT NULL,
    `isActive`    TINYINT(1)   NOT NULL DEFAULT 1,
    `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`   DATETIME(3)  NOT NULL,
    PRIMARY KEY (`id`),
    KEY `Reward_familyId_fkey` (`familyId`),
    CONSTRAINT `Reward_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 7. Redemption — 兑换记录
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Redemption` (
    `id`          VARCHAR(191) NOT NULL,
    `familyId`    VARCHAR(191) NOT NULL,
    `childId`     VARCHAR(191) NOT NULL,
    `rewardId`    VARCHAR(191) NOT NULL,
    `pointsSpent` INTEGER      NOT NULL,
    `status`      VARCHAR(191) NOT NULL DEFAULT 'pending',
    `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt`  DATETIME(3)  NULL     DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `Redemption_familyId_status_idx` (`familyId`, `status`),
    KEY `Redemption_childId_fkey` (`childId`),
    KEY `Redemption_rewardId_fkey` (`rewardId`),
    CONSTRAINT `Redemption_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `Redemption_childId_fkey`  FOREIGN KEY (`childId`)  REFERENCES `User` (`id`)   ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `Redemption_rewardId_fkey` FOREIGN KEY (`rewardId`) REFERENCES `Reward` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 8. 例程模板：大类 / 子任务 / 孩子绑定 / 每日完成记录
-- -------------------------------------------------------------
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
    `quantity`    INTEGER      NOT NULL DEFAULT 1,
    `period`      VARCHAR(191) NOT NULL DEFAULT 'daily',
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
    `progress`       INTEGER      NOT NULL DEFAULT 1,
    `pointsAwarded`  INTEGER      NOT NULL DEFAULT 0,
    `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `SubtaskCompletion_unique_idx` (`childId`, `subtaskId`, `completedDate`),
    KEY `SubtaskCompletion_child_date_idx` (`childId`, `completedDate`),
    CONSTRAINT `SubtaskCompletion_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `SubtaskCompletion_childId_fkey` FOREIGN KEY (`childId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `SubtaskCompletion_subtaskId_fkey` FOREIGN KEY (`subtaskId`) REFERENCES `TemplateSubtask` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `RoutineSettlement` (
    `id`           VARCHAR(191) NOT NULL,
    `familyId`     VARCHAR(191) NOT NULL,
    `childId`      VARCHAR(191) NOT NULL,
    `subtaskId`    VARCHAR(191) NULL,
    `settledDate`  DATE         NOT NULL,
    `points`       INTEGER      NOT NULL DEFAULT 0,
    `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `RoutineSettlement_unique2_idx` (`childId`, `subtaskId`, `settledDate`),
    KEY `RoutineSettlement_family_date_idx` (`familyId`, `settledDate`),
    CONSTRAINT `RoutineSettlement_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `Family` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `RoutineSettlement_childId_fkey` FOREIGN KEY (`childId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `RoutineSettlement_subtaskId_fkey` FOREIGN KEY (`subtaskId`) REFERENCES `TemplateSubtask` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- -------------------------------------------------------------
-- 默认登录账号（家长）：15055120000 / 000000，管理 PIN：1234
-- -------------------------------------------------------------
INSERT INTO `Family` (`id`, `name`, `createdAt`) VALUES ('family_default', '默认家庭', NOW(3));
INSERT INTO `User` (`id`, `familyId`, `name`, `phone`, `passwordHash`, `pinCode`, `role`, `createdAt`, `updatedAt`)
VALUES ('user_default_parent', 'family_default', '默认家长', '15055120000', '$2b$10$tx1Zi.kUeC6QHC2eYu98fe3/uGnFbr/r4Jaz3E02/X/2zMnBFARE6', '$2b$10$McLtfw0xc6CF6hBBvhoupOrkYyRxZUhGl7EKi8OJShKdb0H3LnpQW', 'parent', NOW(3), NOW(3));
