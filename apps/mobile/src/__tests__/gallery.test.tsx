import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useRouter } from 'expo-router';
import CustomGalleryScreen from '../app/gallery';
import HomeScreen from '../app/(tabs)/index';
import { submissionDraftStore } from '../services/draft/submissionDraftStore';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///photo.jpg', width: 800, height: 600, mimeType: 'image/jpeg' }],
  }),
}));

jest.mock('expo-media-library/legacy', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getAssetsAsync: jest.fn(),
  getAssetInfoAsync: jest.fn(),
  MediaType: { photo: 'photo' },
  SortBy: { creationTime: 'creationTime' },
}));

jest.mock('../services/image/imagePipeline', () => ({
  normalizeImageDraft: jest.fn().mockImplementation((uri, w, h) =>
    Promise.resolve({
      uri,
      width: w || 800,
      height: h || 600,
      source: 'GALLERY',
    })
  ),
  logStageDiagnostic: jest.fn(),
}));

describe('AI.HWTEXT.PROD.3F.1 / 3F.2 — Custom Gallery & Direct CTAs', () => {
  const mockPush = jest.fn();
  const mockBack = jest.fn();
  const mockReplace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      back: mockBack,
      replace: mockReplace,
    });
    submissionDraftStore.clearDraft();
  });

  const mockAssets: MediaLibrary.Asset[] = [
    {
      id: 'asset-1',
      filename: 'math1.jpg',
      uri: 'file:///data/photos/math1.jpg',
      mediaType: 'photo',
      width: 1080,
      height: 1920,
      creationTime: 1710000000000,
      modificationTime: 1710000000000,
      duration: 0,
    },
    {
      id: 'asset-2',
      filename: 'math2.jpg',
      uri: 'file:///data/photos/math2.jpg',
      mediaType: 'photo',
      width: 1080,
      height: 1920,
      creationTime: 1710001000000,
      modificationTime: 1710001000000,
      duration: 0,
    },
  ];

  it('GALLERY-01: renders permission denied state when permissions are not granted', async () => {
    (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: false,
      status: 'denied',
    });

    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CustomGalleryScreen />);
    });

    const textNodes = renderer.root.findAllByType('Text').map((node: any) => node.props.children);
    expect(textNodes).toContain('Cần quyền truy cập ảnh');
  });

  it('GALLERY-02: renders empty state when library has 0 assets', async () => {
    (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: 'granted',
    });
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [],
      endCursor: '0',
      hasNextPage: false,
      totalCount: 0,
    });

    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CustomGalleryScreen />);
    });

    const textNodes = renderer.root.findAllByType('Text').map((node: any) => node.props.children);
    expect(textNodes).toContain('Chưa có ảnh trong thư viện');
  });

  it('GALLERY-03: renders grid of assets when permission is granted and loads first page', async () => {
    (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: 'granted',
    });
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: mockAssets,
      endCursor: 'cursor-1',
      hasNextPage: true,
      totalCount: 50,
    });

    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CustomGalleryScreen />);
    });

    const flatList = renderer.root.findByType('RCTScrollView');
    expect(flatList).toBeTruthy();
  });

  it('GALLERY-04: CTA is disabled when no image is selected', async () => {
    (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: 'granted',
    });
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: mockAssets,
      endCursor: 'cursor-1',
      hasNextPage: false,
      totalCount: 2,
    });

    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CustomGalleryScreen />);
    });

    const ctaBtn = renderer.root.findByProps({ accessibilityLabel: 'Dùng ảnh này' });
    expect(ctaBtn.props.disabled).toBe(true);
  });

  it('GALLERY-05: selecting an asset enables the CTA, and switching replaces selection', async () => {
    (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: 'granted',
    });
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: mockAssets,
      endCursor: 'cursor-1',
      hasNextPage: false,
      totalCount: 2,
    });

    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CustomGalleryScreen />);
    });

    // Select asset-1
    const cell1 = renderer.root.findByProps({ testID: 'gallery-cell-asset-1' });
    await act(async () => {
      cell1.props.onPress();
    });

    let ctaBtn = renderer.root.findByProps({ accessibilityLabel: 'Dùng ảnh này' });
    expect(ctaBtn.props.disabled).toBe(false);

    // Switch selection to asset-2
    const cell2 = renderer.root.findByProps({ testID: 'gallery-cell-asset-2' });
    await act(async () => {
      cell2.props.onPress();
    });

    ctaBtn = renderer.root.findByProps({ accessibilityLabel: 'Dùng ảnh này' });
    expect(ctaBtn.props.disabled).toBe(false);
  });

  it('GALLERY-06: confirm sends selected image to draft store and navigates to /privacy', async () => {
    (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: 'granted',
    });
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: mockAssets,
      endCursor: 'cursor-1',
      hasNextPage: false,
      totalCount: 2,
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock).mockResolvedValue({
      localUri: 'file:///data/photos/local_math1.jpg',
    });

    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CustomGalleryScreen />);
    });

    // Select asset-1
    const cell1 = renderer.root.findByProps({ testID: 'gallery-cell-asset-1' });
    await act(async () => {
      cell1.props.onPress();
    });

    // Confirm
    const ctaBtn = renderer.root.findByProps({ accessibilityLabel: 'Dùng ảnh này' });
    await act(async () => {
      await ctaBtn.props.onPress();
    });

    const draft = submissionDraftStore.getDraft();
    expect(draft).not.toBeNull();
    expect(draft?.uri).toBe('file:///data/photos/local_math1.jpg');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/privacy',
      params: { uri: 'file:///data/photos/local_math1.jpg' },
    });
  });

  it('GALLERY-07: back button calls router.back()', async () => {
    (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: 'granted',
    });
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: mockAssets,
      endCursor: 'cursor-1',
      hasNextPage: false,
      totalCount: 2,
    });

    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<CustomGalleryScreen />);
    });

    const backBtn = renderer.root.findByProps({ accessibilityLabel: 'Quay lại' });
    await act(async () => {
      backBtn.props.onPress();
    });

    expect(mockBack).toHaveBeenCalled();
  });

  it('GALLERY-08: Home screen gallery CTA opens native ImagePicker directly without intermediate /gallery route', async () => {
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<HomeScreen />);
    });

    // Camera CTA
    const cameraBtn = renderer.root.findByProps({ accessibilityLabel: 'Chụp ảnh mới' });
    await act(async () => {
      cameraBtn.props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/camera',
      params: { mode: 'HANDWRITING_TEXT' },
    });

    // Gallery CTA — MUST directly invoke native ImagePicker and route to /privacy without /gallery
    const galleryBtn = renderer.root.findByProps({ accessibilityLabel: 'Chọn từ thư viện' });
    await act(async () => {
      await galleryBtn.props.onPress();
    });
    const ImagePicker = require('expo-image-picker');
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    expect(mockPush).not.toHaveBeenCalledWith('/gallery');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/privacy',
      params: { uri: 'file:///photo.jpg' },
    });
  });
});
