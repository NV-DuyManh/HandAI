import React from 'react';
import { BackHandler } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { ImageSourceModal } from '../ImageSourceModal';

describe('ImageSourceModal - Backdrop & Dismissal Lifecycle', () => {
  let backHandlerCallback: (() => boolean) | null = null;
  const onCloseMock = jest.fn();
  const onSelectCameraMock = jest.fn();
  const onSelectGalleryMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    backHandlerCallback = null;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event, callback) => {
      if (event === 'hardwareBackPress') {
        backHandlerCallback = callback as () => boolean;
      }
      return { remove: jest.fn() } as any;
    });
  });

  it('renders nothing when visible is false', () => {
    let renderer: any;
    act(() => {
      renderer = TestRenderer.create(
        <ImageSourceModal
          visible={false}
          onClose={onCloseMock}
          onSelectCamera={onSelectCameraMock}
          onSelectGallery={onSelectGalleryMock}
        />
      );
    });
    expect(renderer.toJSON()).toBeNull();
  });

  it('MODAL-01: backdrop press triggers onClose', () => {
    let renderer: any;
    act(() => {
      renderer = TestRenderer.create(
        <ImageSourceModal
          visible={true}
          onClose={onCloseMock}
          onSelectCamera={onSelectCameraMock}
          onSelectGallery={onSelectGalleryMock}
        />
      );
    });

    const backdrop = renderer.root.findByProps({ testID: 'modal-backdrop' });
    act(() => {
      backdrop.props.onPress();
    });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('MODAL-02: inside-content press stops propagation and does not call onClose', () => {
    let renderer: any;
    act(() => {
      renderer = TestRenderer.create(
        <ImageSourceModal
          visible={true}
          onClose={onCloseMock}
          onSelectCamera={onSelectCameraMock}
          onSelectGallery={onSelectGalleryMock}
        />
      );
    });

    const content = renderer.root.findByProps({ testID: 'modal-content' });
    const stopPropagationMock = jest.fn();
    act(() => {
      content.props.onPress({ stopPropagation: stopPropagationMock });
    });

    expect(stopPropagationMock).toHaveBeenCalledTimes(1);
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('MODAL-03: camera option triggers onSelectCamera and onClose', () => {
    let renderer: any;
    act(() => {
      renderer = TestRenderer.create(
        <ImageSourceModal
          visible={true}
          onClose={onCloseMock}
          onSelectCamera={onSelectCameraMock}
          onSelectGallery={onSelectGalleryMock}
        />
      );
    });

    const cameraBtn = renderer.root.findByProps({ testID: 'option-camera' });
    act(() => {
      cameraBtn.props.onPress();
    });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
    expect(onSelectCameraMock).toHaveBeenCalledTimes(1);
  });

  it('MODAL-04: gallery option triggers onSelectGallery and onClose', () => {
    let renderer: any;
    act(() => {
      renderer = TestRenderer.create(
        <ImageSourceModal
          visible={true}
          onClose={onCloseMock}
          onSelectCamera={onSelectCameraMock}
          onSelectGallery={onSelectGalleryMock}
        />
      );
    });

    const galleryBtn = renderer.root.findByProps({ testID: 'option-gallery' });
    act(() => {
      galleryBtn.props.onPress();
    });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
    expect(onSelectGalleryMock).toHaveBeenCalledTimes(1);
  });

  it('MODAL-05: cancel option triggers onClose', () => {
    let renderer: any;
    act(() => {
      renderer = TestRenderer.create(
        <ImageSourceModal
          visible={true}
          onClose={onCloseMock}
          onSelectCamera={onSelectCameraMock}
          onSelectGallery={onSelectGalleryMock}
        />
      );
    });

    const cancelBtn = renderer.root.findByProps({ testID: 'option-cancel' });
    act(() => {
      cancelBtn.props.onPress();
    });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('MODAL-06: Android hardware back press closes the modal via BackHandler', () => {
    act(() => {
      TestRenderer.create(
        <ImageSourceModal
          visible={true}
          onClose={onCloseMock}
          onSelectCamera={onSelectCameraMock}
          onSelectGallery={onSelectGalleryMock}
        />
      );
    });

    expect(backHandlerCallback).not.toBeNull();
    let handled = false;
    act(() => {
      if (backHandlerCallback) {
        handled = backHandlerCallback();
      }
    });

    expect(handled).toBe(true);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
