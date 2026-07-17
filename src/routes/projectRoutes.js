const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { requireManager } = require("../middleware/auth");
const {
      getProjects,
      getProjectsWithNodes,
      getProjectById,
      postProject,
      copyProjectController,
      patchProject,
      removeProject,
      patchProjectNode,
      seedProjects,
      seedProjectsFromPayload,
} = require("../controllers/projectController");

const router = express.Router();

// Đọc: mọi user đã đăng nhập (requireAuth đã áp ở app.js).
router.get("/", asyncHandler(getProjects));
router.get("/with-nodes", asyncHandler(getProjectsWithNodes));

// Thông tin dự án + seed: chỉ Quản lý.
router.post("/seed/from-payload", requireManager, asyncHandler(seedProjectsFromPayload));
router.post("/", requireManager, asyncHandler(postProject));
// Nhân bản dự án (mã + tên mới, copy toàn bộ bước) — chỉ Quản lý.
router.post("/:projectId/copy", requireManager, asyncHandler(copyProjectController));
router.patch("/:projectId", requireManager, asyncHandler(patchProject));
router.delete("/:projectId", requireManager, asyncHandler(removeProject));

router.get("/:projectId", asyncHandler(getProjectById));

// Sửa 1 bước: Quản lý sửa mọi bước; PIC chỉ sửa bước của mình (kiểm trong controller).
router.patch("/:projectId/nodes/:nodeId", asyncHandler(patchProjectNode));
router.post("/seed/from-json", requireManager, asyncHandler(seedProjects));

module.exports = { projectRoutes: router };
