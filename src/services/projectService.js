const fs = require('node:fs/promises');
const path = require('node:path');
const { getSupabaseClient } = require('../config/supabaseClient');
const { WORKFLOW_NODES, NODE_INDEX } = require('../constants/workflowNodes');

async function ensureMasterNodes() {
  const supabase = getSupabaseClient();
  const rows = WORKFLOW_NODES.map((node) => ({
    code: node.code,
    stage: node.stage,
    name: node.name,
    dept: node.dept,
    default_duration: node.defaultDuration,
    default_after: node.defaultAfter,
  }));

  const { error } = await supabase
    .from('master_nodes')
    .upsert(rows, { onConflict: 'code' });

  if (error) throw error;
}

async function listProjects() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id,code,name,type,product_group,owner,start_date')
    .order('start_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function getProjectDetail(projectId) {
  const supabase = getSupabaseClient();
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  if (projectError) throw projectError;

  const { data: nodes, error: nodesError } = await supabase
    .from('project_nodes')
    .select('*')
    .eq('project_id', projectId)
    .order('node_id', { ascending: true });
  if (nodesError) throw nodesError;
  const { data: masterNodes, error: masterError } = await supabase
    .from('master_nodes')
    .select('code,name,stage')
    .order('code', { ascending: true });
  if (masterError) throw masterError;

  const masterMap = Object.fromEntries((masterNodes ?? []).map((item) => [item.code, item]));
  const mergedNodes = (nodes ?? []).map((node) => ({
    ...node,
    node_name: masterMap[node.node_id]?.name || node.node_id,
    stage: masterMap[node.node_id]?.stage || node.node_id.charAt(0),
  }));

  return { project, nodes: mergedNodes };
}

async function updateProjectNode(projectId, nodeId, payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('project_nodes')
    .update(payload)
    .eq('project_id', projectId)
    .eq('node_id', nodeId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function listProjectsWithNodes() {
  const supabase = getSupabaseClient();

  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id,code,name,type,product_group,owner,start_date')
    .order('start_date', { ascending: true });
  if (projectsError) throw projectsError;

  const ids = (projects ?? []).map((p) => p.id);
  if (ids.length === 0) return [];

  const { data: nodes, error: nodesError } = await supabase
    .from('project_nodes')
    .select('*')
    .in('project_id', ids)
    .order('project_id', { ascending: true })
    .order('node_id', { ascending: true });
  if (nodesError) throw nodesError;

  const { data: masterNodes, error: masterError } = await supabase
    .from('master_nodes')
    .select('code,name,stage')
    .order('code', { ascending: true });
  if (masterError) throw masterError;

  const masterMap = Object.fromEntries(
    (masterNodes ?? []).map((item) => [item.code, item]),
  );

  const nodesByProjectId = new Map();
  for (const node of nodes ?? []) {
    const enriched = {
      ...node,
      node_name: masterMap[node.node_id]?.name || node.node_id,
      stage: masterMap[node.node_id]?.stage || node.node_id.charAt(0),
    };
    if (!nodesByProjectId.has(node.project_id)) nodesByProjectId.set(node.project_id, []);
    nodesByProjectId.get(node.project_id).push(enriched);
  }

  return (projects ?? []).map((p) => ({
    project: p,
    nodes: nodesByProjectId.get(p.id) ?? [],
  }));
}

async function createProject(payload) {
  const supabase = getSupabaseClient();

  await ensureMasterNodes();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert([payload])
    .select('*')
    .single();
  if (projectError) throw projectError;

  const { data: masterNodes, error: masterError } = await supabase
    .from('master_nodes')
    .select('*')
    .order('code', { ascending: true });
  if (masterError) throw masterError;

  const rows = (masterNodes ?? []).map((n) => ({
    project_id: project.id,
    node_id: n.code,
    status: 'Chưa làm',
    pic: '',
    duration: n.default_duration,
    actual_date: null,
    notes: '',
    dept: n.dept,
    after: n.default_after || [],
    attachments: [],
  }));

  if (rows.length) {
    const { error: nodesError } = await supabase.from('project_nodes').insert(rows);
    if (nodesError) throw nodesError;
  }

  return project;
}

async function updateProject(projectId, payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .update(payload)
    .eq('id', projectId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function deleteProject(projectId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) throw error;
  return { ok: true };
}

async function upsertProjectFromJsonRow(projectJson) {
  const supabase = getSupabaseClient();

  const projectPayload = {
    code: projectJson.id,
    name: projectJson.name,
    type: projectJson.type,
    product_group: projectJson.group || null,
    owner: projectJson.owner || null,
    start_date: projectJson.startDate,
  };

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .upsert([projectPayload], { onConflict: 'code' })
    .select('*')
    .single();
  if (projectError) throw projectError;

  const nodes = Object.entries(projectJson.nodes || {}).map(([nodeId, nodeData]) => {
    const nodeMeta = NODE_INDEX[nodeId];
    return {
      project_id: project.id,
      node_id: nodeId,
      status: nodeData.status || 'Chua lam',
      pic: nodeData.pic || '',
      duration:
        typeof nodeData.duration === 'number'
          ? nodeData.duration
          : nodeMeta?.defaultDuration || 1,
      actual_date: nodeData.actualDate || null,
      notes: nodeData.notes || '',
      dept: nodeData.dept || nodeMeta?.dept || null,
      after: Array.isArray(nodeData.after) ? nodeData.after : nodeMeta?.defaultAfter || [],
      attachments: Array.isArray(nodeData.attachments) ? nodeData.attachments : [],
    };
  });

  if (nodes.length > 0) {
    const { error: nodesError } = await supabase
      .from('project_nodes')
      .upsert(nodes, { onConflict: 'project_id,node_id' });
    if (nodesError) throw nodesError;
  }

  return project;
}

async function seedFromJsonFile(jsonFilePath) {
  const fullPath = path.resolve(jsonFilePath);
  const content = await fs.readFile(fullPath, 'utf8');
  const parsed = JSON.parse(content);
  const projects = parsed.projects || [];

  await ensureMasterNodes();
  for (const project of projects) {
    await upsertProjectFromJsonRow(project);
  }

  return { total: projects.length, path: fullPath };
}

async function seedFromPayload(projects) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  await ensureMasterNodes();
  for (const project of safeProjects) {
    await upsertProjectFromJsonRow(project);
  }
  return { total: safeProjects.length };
}

module.exports = {
  ensureMasterNodes,
  listProjects,
  listProjectsWithNodes,
  getProjectDetail,
  createProject,
  updateProject,
  deleteProject,
  updateProjectNode,
  seedFromJsonFile,
  seedFromPayload,
};

