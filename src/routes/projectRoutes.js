const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  getProjects,
  getProjectsWithNodes,
  getProjectById,
  postProject,
  patchProject,
  removeProject,
  patchProjectNode,
  seedProjects,
  seedProjectsFromPayload,
} = require('../controllers/projectController');

const router = express.Router();

router.get('/', asyncHandler(getProjects));
router.get('/with-nodes', asyncHandler(getProjectsWithNodes));
router.post('/seed/from-payload', asyncHandler(seedProjectsFromPayload));
router.post('/', asyncHandler(postProject));
router.patch('/:projectId', asyncHandler(patchProject));
router.delete('/:projectId', asyncHandler(removeProject));
router.get('/:projectId', asyncHandler(getProjectById));
router.patch('/:projectId/nodes/:nodeId', asyncHandler(patchProjectNode));
router.post('/seed/from-json', asyncHandler(seedProjects));

module.exports = { projectRoutes: router };

