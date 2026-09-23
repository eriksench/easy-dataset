import { getSessionFromRequest } from '@/lib/auth/session';
import { db } from '@/lib/db';

const LOCAL_USER = Object.freeze({
  userId: 'local',
  username: 'local',
  realName: 'Local User'
});

const PARAM_RESOURCE_MODELS = Object.freeze({
  chunkId: 'chunks',
  conversationId: 'datasetConversations',
  evalId: 'evalDatasets',
  fileId: 'uploadFiles',
  imageId: 'images',
  modelConfigId: 'modelConfig',
  questionId: 'questions',
  tagId: 'tags',
  taskId: 'task',
  templateId: 'questionTemplates'
});

const BODY_RESOURCE_MODELS = Object.freeze({
  chunkId: 'chunks',
  chunkIds: 'chunks',
  conversationId: 'datasetConversations',
  conversationIds: 'datasetConversations',
  defaultModelConfigId: 'modelConfig',
  evalDatasetId: 'evalDatasets',
  evalDatasetIds: 'evalDatasets',
  evalId: 'evalDatasets',
  evalIds: 'evalDatasets',
  fileId: 'uploadFiles',
  fileIds: 'uploadFiles',
  gaPairId: 'gaPairs',
  gaPairIds: 'gaPairs',
  imageId: 'images',
  imageIds: 'images',
  modelConfigId: 'modelConfig',
  modelConfigIds: 'modelConfig',
  parentId: 'tags',
  parentTagId: 'tags',
  questionId: 'questions',
  questionIds: 'questions',
  tagId: 'tags',
  tagIds: 'tags',
  taskId: 'task',
  taskIds: 'task',
  templateId: 'questionTemplates',
  templateIds: 'questionTemplates'
});

function ssoEnabled() {
  return process.env.KNOW_HUB_SSO_ENABLED !== 'false';
}

export async function getCurrentUser(request) {
  if (!ssoEnabled()) return LOCAL_USER;

  const session = await getSessionFromRequest(request);
  const userId = session?.user?.userId;
  if (typeof userId !== 'string' || !userId.trim()) return null;

  return { ...session.user, userId: userId.trim() };
}

export function authenticationRequiredResponse() {
  return Response.json({ error: 'Authentication required' }, { status: 401 });
}

export function projectNotFoundResponse() {
  return Response.json({ error: 'Project not found' }, { status: 404 });
}

export async function getOwnedProject(projectId, ownerUserId, select) {
  if (!projectId || !ownerUserId) return null;
  return db.projects.findFirst({
    where: { id: projectId, ownerUserId },
    ...(select ? { select } : {})
  });
}

export async function requireOwnedProject(request, projectId) {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return { response: authenticationRequiredResponse() };
  }

  const project = await getOwnedProject(projectId, currentUser.userId, { id: true, ownerUserId: true });
  if (!project) {
    return { response: projectNotFoundResponse() };
  }

  return { currentUser, project };
}

function datasetModel(pathname) {
  return pathname.includes('/image-datasets') ? 'imageDatasets' : 'datasets';
}

function genericIdModel(pathname) {
  if (pathname.includes('/image-datasets')) return 'imageDatasets';
  if (pathname.includes('/eval-datasets')) return 'evalDatasets';
  if (pathname.includes('/datasets')) return 'datasets';
  if (pathname.includes('/tags')) return 'tags';
  return null;
}

function selectedIdsModel(pathname) {
  if (pathname.includes('/image-datasets')) return 'imageDatasets';
  if (pathname.includes('/eval-datasets')) return 'evalDatasets';
  if (pathname.includes('/questions')) return 'questions';
  if (pathname.includes('/datasets')) return 'datasets';
  return null;
}

function addResourceIds(resources, model, values) {
  if (!model || values === undefined || values === null || values === '') return;
  const ids = Array.isArray(values) ? values : [values];
  if (!resources.has(model)) resources.set(model, new Set());
  for (const id of ids) {
    if (typeof id === 'string' && id) resources.get(model).add(id);
  }
}

async function requestJson(request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return null;
  try {
    return await request.clone().json();
  } catch {
    return null;
  }
}

async function requestResourcesBelongToProject(request, params, projectId) {
  const url = new URL(request.url);
  const resources = new Map();

  for (const [paramName, model] of Object.entries(PARAM_RESOURCE_MODELS)) {
    addResourceIds(resources, model, params[paramName]);
  }
  addResourceIds(resources, datasetModel(url.pathname), params.datasetId);

  for (const [field, model] of Object.entries(BODY_RESOURCE_MODELS)) {
    const queryValue = url.searchParams.get(field);
    if (queryValue) addResourceIds(resources, model, queryValue.split(',').filter(Boolean));
  }
  addResourceIds(resources, genericIdModel(url.pathname), url.searchParams.get('id'));

  const body = await requestJson(request);
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    for (const [field, model] of Object.entries(BODY_RESOURCE_MODELS)) {
      let resolvedModel = model;
      if ((field === 'questionId' || field === 'questionIds') && url.pathname.includes('/blind-test-tasks/')) {
        resolvedModel = 'evalDatasets';
      }
      addResourceIds(resources, resolvedModel, body[field]);
    }

    addResourceIds(resources, datasetModel(url.pathname), body.datasetId);
    addResourceIds(resources, datasetModel(url.pathname), body.datasetIds);
    addResourceIds(resources, selectedIdsModel(url.pathname), body.selectedIds);

    if (url.pathname.endsWith('/chunks')) {
      addResourceIds(resources, 'uploadFiles', body.array);
    }
    if (url.pathname.endsWith('/tags')) {
      addResourceIds(resources, 'tags', body.tags?.id);
      addResourceIds(resources, 'tags', body.tags?.parentId);
    }
  }

  for (const [model, idSet] of resources) {
    const ids = [...idSet];
    if (ids.length === 0) continue;
    const count = await db[model].count({ where: { projectId, id: { in: ids } } });
    if (count !== ids.length) return false;
  }
  return true;
}

export function withProjectAccess(handler) {
  return async function projectAccessHandler(request, context = {}) {
    try {
      const params = await Promise.resolve(context.params || {});
      const access = await requireOwnedProject(request, params.projectId);
      if (access.response) return access.response;

      if (!(await requestResourcesBelongToProject(request, params, access.project.id))) {
        return projectNotFoundResponse();
      }

      return handler(request, {
        ...context,
        params,
        currentUser: access.currentUser,
        authorizedProject: access.project
      });
    } catch (error) {
      console.error('Project access check failed:', String(error));
      return Response.json({ error: 'Failed to authorize project access' }, { status: 500 });
    }
  };
}
