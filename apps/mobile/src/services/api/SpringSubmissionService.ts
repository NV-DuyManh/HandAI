import { Platform } from 'react-native';
import apiClient from './apiClient';
import { SubmissionService, SubmissionResult } from '../../types';
import { ensureFileUri, logStageDiagnostic } from '../image/imagePipeline';
import { submissionDraftStore } from '../draft/submissionDraftStore';

export class SpringSubmissionServiceClass implements SubmissionService {
  async uploadImage(uri: string): Promise<SubmissionResult> {
    const cleanUri = ensureFileUri(Array.isArray(uri) ? uri[0] : uri);
    const formData = new FormData();
    
    // Extract a safe filename and mime type
    const rawFilename = cleanUri.split('/').pop() || 'submission.jpg';
    const safeFilename = rawFilename.includes('.') ? rawFilename.split('?')[0] : 'submission.jpg';
    const match = /\.(\w+)$/.exec(safeFilename);
    const type = match && match[1].toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
    
    // React Native FormData file object contract
    formData.append('image', {
      uri: Platform.OS === 'ios' ? cleanUri.replace('file://', '') : cleanUri,
      name: safeFilename,
      type,
    } as any);
    
    const draft = submissionDraftStore.getDraft();
    const source = draft?.source || 'CAMERA';
    formData.append('source', source);

    logStageDiagnostic('MULTIPART_READY', {
      uri: cleanUri,
      width: draft?.width,
      height: draft?.height,
      mimeType: type,
      source,
      extra: `filename=${safeFilename}`,
    });
    
    // Do NOT specify explicit 'Content-Type': 'multipart/form-data'!
    // In React Native / Axios, setting Content-Type manually removes the boundary parameter,
    // causing OkHttp to fail with AxiosError: Network Error.
    const response = await apiClient.post('/student/submissions', formData, {
      headers: {
        Accept: 'application/json',
      },
      transformRequest: [(data) => data],
    });
    
    const data = response.data;
    const submissionId = data.submissionId || data.id;

    logStageDiagnostic('UPLOAD_RESPONSE', {
      uri: cleanUri,
      source,
      extra: `HTTP ${response.status} id=${submissionId} status=${data.status}`,
    });

    return {
      ...data,
      id: submissionId,
    } as SubmissionResult;
  }

  async getSubmission(id: string, scenarioHint?: string): Promise<SubmissionResult> {
    const response = await apiClient.get(`/student/submissions/${id}`);
    const data = response.data;
    return {
      ...data,
      id: data.submissionId || data.id,
    } as SubmissionResult;
  }

  async confirmToken(id: string, token: string): Promise<SubmissionResult> {
    const response = await apiClient.post(`/student/submissions/${id}/confirm-token`, {
      tokenId: 'manual-confirm',
      confirmedValue: token
    });
    const data = response.data;
    return {
      ...data,
      id: data?.submissionId || data?.id || id,
    } as SubmissionResult;
  }

  async retrySubmission(id: string, uri: string): Promise<SubmissionResult> {
    const cleanUri = ensureFileUri(Array.isArray(uri) ? uri[0] : uri);
    const formData = new FormData();
    
    const rawFilename = cleanUri.split('/').pop() || 'retry.jpg';
    const safeFilename = rawFilename.includes('.') ? rawFilename.split('?')[0] : 'retry.jpg';
    const match = /\.(\w+)$/.exec(safeFilename);
    const type = match && match[1].toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
    
    formData.append('image', {
      uri: Platform.OS === 'ios' ? cleanUri.replace('file://', '') : cleanUri,
      name: safeFilename,
      type,
    } as any);
    
    formData.append('source', 'CAMERA');

    const response = await apiClient.post(`/student/submissions/${id}/retry`, formData, {
      headers: {
        Accept: 'application/json',
      },
      transformRequest: [(data) => data],
    });

    const data = response.data;
    return {
      ...data,
      id: data?.submissionId || data?.id || id,
    } as SubmissionResult;
  }
}

export const SpringSubmissionService = new SpringSubmissionServiceClass();
