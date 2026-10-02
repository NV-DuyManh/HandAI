import { normalizeLocalFileUri, resolveSafeCropImage } from '../imagePipeline';
import { submissionDraftStore } from '../../draft/submissionDraftStore';
import { Platform } from 'react-native';

jest.mock('expo-image-manipulator', () => ({ manipulateAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }));
jest.mock('../../../config/appMode', () => ({ isHandAIMode: () => true }));

describe('uploaded browser image URI handling', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each([
    'blob:http://127.0.0.1:8087/owner-photo',
    'data:image/jpeg;base64,aGVsbG8=',
    'file:///cache/ExperienceData/%2540anonymous%2Fphoto.jpg',
    'content://photos/42',
  ])('preserves a usable URI without file-prefixing or decoding: %s', (uri) => {
    expect(normalizeLocalFileUri(uri)).toBe(uri);
  });

  it('keeps a gallery blob displayable when resolving the web crop source', async () => {
    const uri = 'blob:http://127.0.0.1:8087/owner-photo';
    expect(await resolveSafeCropImage(uri)).toEqual({
      originalUri: uri, normalizedUri: uri, exists: true, finalUri: uri,
    });
  });

  it('still normalizes a native local path', () => {
    expect(normalizeLocalFileUri('/cache/photo.jpg')).toBe('file:///cache/photo.jpg');
  });

  test.each(['blob:http://127.0.0.1:8087/owner-photo', 'data:image/jpeg;base64,aGVsbG8='])(
    'preserves the browser image through draft creation and crop updates: %s', (uri) => {
      submissionDraftStore.setDraft({ rawUri: uri, uri, originalImageUri: uri,
        width: 932, height: 916, mimeType: 'image/jpeg', filename: 'owner.jpg', source: 'GALLERY' });
      expect(submissionDraftStore.getDraft()?.originalImageUri).toBe(uri);
      submissionDraftStore.updateDraft({ originalImageUri: uri, croppedImageUri: uri });
      expect(submissionDraftStore.getDraft()?.originalImageUri).toBe(uri);
      submissionDraftStore.clearDraft();
    }
  );
});
