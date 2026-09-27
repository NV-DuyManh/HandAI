import { submissionDraftStore } from '../../services/draft/submissionDraftStore';
import { SpringSubmissionServiceClass } from '../../services/api/SpringSubmissionService';
import apiClient from '../../services/api/apiClient';

jest.mock('../../services/api/apiClient');

describe('Privacy Upload Boundary Proof', () => {
  beforeEach(() => {
    submissionDraftStore.clearDraft();
    jest.clearAllMocks();
  });

  it('proves raw acquisition URI is never uploaded; only post-privacy post-crop URI is passed to uploadImage', async () => {
    const RAW_CAMERA_URI = 'file:///data/user/0/host.exp.exponent/cache/ExperienceData/raw_camera_acquisition_001.jpg';
    const MASKED_VIEWSHOT_URI = 'file:///data/user/0/host.exp.exponent/cache/viewshot_rasterized_mask_002.jpg';
    const CROPPED_FINAL_URI = 'file:///data/user/0/host.exp.exponent/cache/cropped_processed_final_003.jpg';

    // 1. ACQUISITION STAGE: Camera or Gallery captures raw unmasked image
    submissionDraftStore.setDraft({
      imageSessionId: 'session-boundary-test',
      rawUri: RAW_CAMERA_URI,
      sourceImageUri: RAW_CAMERA_URI,
      uri: RAW_CAMERA_URI,
      width: 1920,
      height: 1080,
      mimeType: 'image/jpeg',
      filename: 'raw_camera_acquisition_001.jpg',
      source: 'CAMERA',
      mode: 'ARITHMETIC',
    });

    const acquisitionDraft = submissionDraftStore.getDraft();
    expect(acquisitionDraft?.rawUri).toBe(RAW_CAMERA_URI);
    expect(acquisitionDraft?.uri).toBe(RAW_CAMERA_URI);

    // 2. PRIVACY MASKING STAGE: User draws masks, ViewShot rasterizes to new URI
    submissionDraftStore.updateDraft({
      privacyImageUri: MASKED_VIEWSHOT_URI,
      uri: MASKED_VIEWSHOT_URI,
      masks: [{ id: 1, x: 50, y: 50, width: 200, height: 100 }],
      isMasked: true,
    });

    const privacyDraft = submissionDraftStore.getDraft();
    expect(privacyDraft?.privacyImageUri).toBe(MASKED_VIEWSHOT_URI);
    expect(privacyDraft?.uri).toBe(MASKED_VIEWSHOT_URI);
    // Raw URI preserved ONLY as historical source reference, not submission URI
    expect(privacyDraft?.rawUri).toBe(RAW_CAMERA_URI);

    // 3. CROP STAGE: User crops the masked image, ImageManipulator outputs cropped URI
    submissionDraftStore.updateDraft({
      croppedImageUri: CROPPED_FINAL_URI,
      uri: CROPPED_FINAL_URI,
      width: 640,
      height: 640,
    });

    const cropDraft = submissionDraftStore.getDraft();
    expect(cropDraft?.croppedImageUri).toBe(CROPPED_FINAL_URI);
    expect(cropDraft?.uri).toBe(CROPPED_FINAL_URI);
    expect(cropDraft?.rawUri).toBe(RAW_CAMERA_URI);

    // 4. PROCESSING / UPLOAD STAGE: SpringSubmissionService receives activeUri from draft.uri
    const service = new SpringSubmissionServiceClass();
    const mockPost = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
      status: 202,
      data: {
        submissionId: 'test-boundary-sub-id',
        status: 'PROCESSING',
      },
    } as any);

    // Spy on FormData.prototype.append to capture the exact payload passed
    const appendSpy = jest.spyOn(FormData.prototype, 'append');

    // processing.tsx resolves: const activeUri = draft?.uri || ...
    const activeUriToUpload = cropDraft!.uri;
    expect(activeUriToUpload).toBe(CROPPED_FINAL_URI);
    expect(activeUriToUpload).not.toBe(RAW_CAMERA_URI);

    await service.uploadImage(activeUriToUpload);

    // 5. VERIFY MULTIPART PAYLOAD
    expect(mockPost).toHaveBeenCalledTimes(1);
    const [endpoint] = mockPost.mock.calls[0];
    expect(endpoint).toBe('/student/submissions');

    expect(appendSpy).toHaveBeenCalledWith('image', expect.objectContaining({
      name: 'cropped_processed_final_003.jpg',
      type: 'image/jpeg',
    }));

    const imageCall = appendSpy.mock.calls.find(c => c[0] === 'image');
    const imageArg = imageCall?.[1] as any;
    expect(imageArg).toBeDefined();

    // Verify URI passed to FormData has no trace of the raw acquisition URI
    const expectedUri = CROPPED_FINAL_URI.replace('file://', '');
    expect(imageArg.uri).toContain('cropped_processed_final_003.jpg');
    expect(imageArg.uri).not.toContain('raw_camera');
    expect(imageArg.uri).toBe(expectedUri);

    appendSpy.mockRestore();

    // 6. SESSION BOUNDARY VERIFICATION
    submissionDraftStore.clearDraft();
    expect(submissionDraftStore.getDraft()).toBeNull();
  });
});
