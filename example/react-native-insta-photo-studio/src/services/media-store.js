import ImageMedia from './image-media';
import EventEmitter from 'react-native/Libraries/EventEmitter/EventEmitter';
export default class MediaStore {

    constructor(eventEmitter, magnification, window) {
        this.eventEmitter = eventEmitter;
        this.currentMagnification = magnification;
        this.currentWindow = window;

        this.selectedAsset = null;
        this.markedForExportMedia = [];

        this.currentLoadedMedia = [];
        this.multiExportMode = true;
        this.setupAutomaticSelection();
        this.setupMarkForExportMode();
    }

    onToogleMultiExportMode(cb, initalCallback) {
        if (initalCallback) {
            cb && cb(this.multiExportMode);
        }
        this.eventEmitter.addListener('onToogleMultiExportMode', cb);
        return () => this.eventEmitter.removeListener('onToogleMultiExportMode', cb);
    }

    onMarkedForExportMediaChanged(cb, initalCallback) {
        if (initalCallback) {
            cb && cb(this.markedForExportMedia);
        }
        this.eventEmitter.addListener('onMarkedForExportMediaChanged', cb);
        return () => this.eventEmitter.removeListener('onMarkedForExportMediaChanged', cb);
    }

    toogleMultiExportMode() {
        this.multiExportMode = !this.multiExportMode;
        this.eventEmitter.emit('onToogleMultiExportMode', this.multiExportMode);
    }

    setupAutomaticSelection() {
        this.eventEmitter.onAlbumAssetServiceChanged((albumAssetService) => {
            if (this.newAssetUnsubscribe) {
                this.newAssetUnsubscribe();
            }
            this.newAssetUnsubscribe = albumAssetService.onNewAssetsRecived((columnAssets, newAssets, allAssets) => {
                if (allAssets.length) {
                    if (this.multiExportMode && this.selectedAsset) {
                        return;
                    }
                    const previouslySelected = this.selectedAsset;
                    this.selectedAsset = allAssets[0];
                    this.emitSelectionChanged(this.selectedAsset, previouslySelected, albumAssetService);
                    if (this.newAssetUnsubscribe) {
                        this.newAssetUnsubscribe();
                    }
                }
            });
        });
    }

    setupMarkForExportMode() {
        this.onToogleMultiExportMode((multiExportModeEnabled) => {
            if (!multiExportModeEnabled) {
                const previouslyMarked = this.markedForExportMedia;
                this.markedForExportMedia = [this.selectedAsset];
                this.eventEmitter.emit('onMarkedForExportMediaChanged', this.markedForExportMedia, this.selectedAsset, this.markedForExportMedia.concat(previouslyMarked));
            }
        });
        this.eventEmitter.addListener('onSelectionChanged', (newSelectionMedia, oldSelection, albumAssetService) => {
            if (this.multiExportMode) {
                const alreadyMarkedMedia = this.markedForExportMedia.find(media => media === newSelectionMedia);
                if (!alreadyMarkedMedia) {
                    this.markedForExportMedia.push(newSelectionMedia);
                    this.eventEmitter.emit('onMarkedForExportMediaChanged', this.markedForExportMedia, newSelectionMedia, this.markedForExportMedia);
                }
            } else {
                const previouslyMarked = this.markedForExportMedia;
                this.markedForExportMedia = [newSelectionMedia];
                this.eventEmitter.emit('onMarkedForExportMediaChanged', this.markedForExportMedia, newSelectionMedia, this.markedForExportMedia.concat(previouslyMarked));
            }
        });
        this.eventEmitter.addListener('onUnmarkRequested', (mediaToUnmark, albumAssetService) => {
            if (this.multiExportMode) {
                const alreadyMarkedMediaIndex = this.markedForExportMedia.indexOf(mediaToUnmark);
                if (alreadyMarkedMediaIndex !== -1) {
                    this.markedForExportMedia.splice(alreadyMarkedMediaIndex, 1);
                    this.eventEmitter.emit('onMarkedForExportMediaChanged', this.markedForExportMedia, mediaToUnmark, [...this.markedForExportMedia, mediaToUnmark]);
                    if (this.markedForExportMedia.length) {
                        const imageToSelect = this.markedForExportMedia[this.markedForExportMedia.length - 1];
                        this.selectionRequested(albumAssetService, imageToSelect);
                    }
                } else {
                    //Media does not exist should be added
                    this.markedForExportMedia.push(mediaToUnmark);
                    this.eventEmitter.emit('onMarkedForExportMediaChanged', this.markedForExportMedia, mediaToUnmark, this.markedForExportMedia);
                }
            }
        });
    }

    emitSelectionChanged(newSelectionImage, oldSelection, albumAssetService) {
        const newSelectionMedia = this.getImageMedia(newSelectionImage);
        this.eventEmitter.emit('onSelectionChanged', newSelectionMedia, oldSelection, albumAssetService);
    }

    selectionRequested(albumAssetService, asset) {
        console.log('self');
        if (this.selectedAsset && asset.uri === this.selectedAsset.uri) {
            this.eventEmitter.emit('onUnmarkRequested', this.getImageMedia(asset), albumAssetService);
            return;
        }
        const previouslySelected = this.selectedAsset;
        this.selectedAsset = asset;
        this.emitSelectionChanged(this.selectedAsset, previouslySelected, albumAssetService);
    }

    _setSelectionAndReturnImagesToRerender(asset) {
        let imagesToRerender = [];
        const selectedAsset = this.selectedAssets.find(media => media.uri === asset.uri);
        if (selectedAsset) {
            if (asset.uri === selectedAsset.uri) {
                return;
            }
            const indexOfSelectedAsset = this.selectedAssets.indexOf(selectedAsset);
            this.selectedAssets.splice(indexOfSelectedAsset, 1);
            imagesToRerender.push(selectedAsset);
            return {
                imagesToRerender
            };
        }
        if (!this.multiSelectMode && this.selectedAssets.length > 0) {
            imagesToRerender = this.selectedAssets;
            this.selectedAssets = [];
        }
        const media = this.getImageMedia(asset);
        imagesToRerender.push(media);
        this.selectedAssets.push(media);
        return {
            imagesToRerender,
            newSelection: media
        };
    }

    deselectAssets(assets) {
        let imagesToRerender = [];
        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i];
            const selectedAsset = this.selectedAssets.find(media => media.uri === asset.uri);
            if (selectedAsset) {
                const indexOfSelectedAsset = this.selectedAssets.indexOf(selectedAsset);
                this.selectedAssets.splice(indexOfSelectedAsset, 1);
                imagesToRerender.push(selectedAsset);
            }
        }
        if (imagesToRerender.length) {
            this.eventEmitter.emit('onSelectionChanged', this.selectedAssets, selectionModel.imagesToRerender, selectionModel.newSelection, albumAssetService);
        }
    }

    getImageMedia(image) {
        const imageToUse = (typeof image === 'string') ? {
            uri: image
        } : image;
        const currentImageMedia = this.currentLoadedMedia.find(cropperImage => cropperImage.uri === imageToUse.uri);
        if (currentImageMedia) {
            return currentImageMedia;
        }
        const imageMedia = new ImageMedia();
        imageMedia.initWithAsset(imageToUse, this.currentMagnification, this.currentWindow);
        this.currentLoadedMedia.push(imageMedia);
        return imageMedia;
    }
}