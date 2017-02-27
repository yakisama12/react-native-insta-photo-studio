import React, {Component} from 'react'
import {
  ActivityIndicator,
  CameraRoll,
  Image,
  Platform,
  StyleSheet,
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  ListView,
  InteractionManager,
  ScrollView,
  PanResponder,
  TouchableWithoutFeedback
} from 'react-native';
import WindowedListView from 'react-native/Libraries/Experimental/WindowedListView';
import debounce from 'debounce';
import {ScrollViewPanDelegator, BoundarySwipeDelgator, ContentOffsetDelegator, swipeUpDetector, swipeDownDetector} from '../../pan-delegator/scroll-view-pan-delegator';
import cameraRollService from '../../services/camera-roll-service';
class CameraRollPicker extends Component {
  constructor(props) {
    super(props);
    this.state = {
      images: [],
      selected: this.props.selected,
      noMore: false,
      shouldUpdate: this.guid(),
      bounces: true
    };
    this._onEndReachedDebounce = debounce(this._onEndReached, 200).bind(this);
    this.setupScrollViewPanDelegator(props);
    this.lastContentOffset = {
      y: 0,
      x: 0
    };
    this.startIndex = 0;
  }

  setupScrollViewPanDelegator(props) {
    this.scrollViewPanDelegator = new ScrollViewPanDelegator([
      new BoundarySwipeDelgator(swipeUpDetector, props.top, this.props),
      new ContentOffsetDelegator(swipeDownDetector, this.props, {
        setBounce: (bounces) => {
          this.setState({bounces: bounces});
        }
      })
    ]);
    this.scrollViewPanDelegatorBound = {
      onTouchMove: this.scrollViewPanDelegator.onTouchMove.bind(this.scrollViewPanDelegator),
      onTouchEnd: this.scrollViewPanDelegator.onTouchEnd.bind(this.scrollViewPanDelegator),
      onTouchStart: this.scrollViewPanDelegator.onTouchStart.bind(this.scrollViewPanDelegator),
      onScroll: this.scrollViewPanDelegator.onScroll.bind(this.scrollViewPanDelegator)
    };
  }

  componentWillMount() {
    let {width} = Dimensions.get('window');
    let {imageMargin, imagesPerRow, containerWidth} = this.props;

    if (typeof containerWidth != "undefined") {
      width = containerWidth;
    }
    this._imageSize = (width / imagesPerRow) - ((imageMargin * (imagesPerRow - 1)) / imagesPerRow);
    this.setupChangeHandling(this.props.currentAlbum);
    this.fetch();

    this.setState({
      cellStyles: StyleSheet.create({
        imageSize: {
          height: this._imageSize,
          width: this._imageSize
        },
        cellMargin: {
          paddingTop: imageMargin,
          paddingRight: imageMargin
        }
      })
    });
  }

  componentWillReceiveProps(nextProps) {
    this.setState({selected: nextProps.selected});
    if (nextProps.currentAlbum !== this.props.currentAlbum) {
      this.unsubscribeFromAlbum();
      this.setState({
        images : [],
        noMore: false
      }, () => {
        this.setupChangeHandling(nextProps.currentAlbum);
        this.scrollToRow(0, undefined, false);
        this.fetchRound = -1;
        this.startIndex = 0;
        this.fetch(true, true);
      });
    }
  }

  componentWillUnMount() {
    this.unsubscribeFromAlbum();
  }

  unsubscribeFromAlbum() {
    if(this.albumChangeHandler) {
      this.albumChangeHandler();
      if(this.props.currentAlbum) {
        console.log('STOP TRACKING', this.props.currentAlbum.title);
        this.props.currentAlbum.stopTracking();
      }
    }
  }

  setupChangeHandling(album) {
    if(album) {
      console.log('setup change tracking for', album.title);
      this.albumChangeHandler = album.onChange((changeDetails, update) => {
        const updatedImagesArray = update(this.state.images);
        if(this.state.selected && this.state.selected.length) {
          const selectedImagesToRemove = [];
          const newSelectedImages = this.state.selected.filter((selected, index) => {
            return updatedImagesArray.some(asset => asset.localIdentifier === selected.localIdentifier);
          });

          if(!newSelectedImages.length) {
            if(updatedImagesArray.length) {
              const imageToSelect = updatedImagesArray[0];
              newSelectedImages.push(imageToSelect);
              this.props.onSelectedImagesChanged(newSelectedImages, undefined);
            }else {

            }
          }
          console.log('Album Change', changeDetails, album.title,newSelectedImages);

          this.setState({
            selected : newSelectedImages
          });
        }
        this.setState({
          images : updatedImagesArray,
          dataSource : this.appendToState([], updatedImagesArray, this.props.imagesPerRow),
          shouldUpdate : this.guid()
        });
      });
    }
  }

  fetch(force, resetState) {
    if (this.fetchInProgress && !force) {
      return;
    }
    this.fetchInProgress = true;
    if (this.fetchRound === undefined) {
      this.fetchRound = -1;
    }
    this.fetchRound++;
    var {groupTypes, assetType} = this.props;

    const fetchNum = 12;
    const fetchNumber = this.fetchRound === 0
      ? fetchNum
      : (fetchNum * (this.fetchRound + 1)) * 3;

    var fetchParams = {
      trackInsertsAndDeletes : true,
      trackChanges : false,
      startIndex: this.startIndex,
      endIndex: this.startIndex + fetchNumber
    };

    const fetchFromAlbum = this.props.currentAlbum;
    this.props.currentAlbum.getAssets(fetchParams).then((data) => {
      if (fetchFromAlbum === this.props.currentAlbum) {
        this.startIndex = (this.startIndex + (data.assets.length));
        if (this.fetchRound === 0) {
          this.setInitalSelection(data.assets);
        }
        this._appendImages(data, resetState);
        this.fetchInProgress = false;
        if (this.fetchRound === 0 || this.fetchRound === 1) {
          this.fetch(true);
        }
      }
    }, (e) => console.log(e));
  }

  setInitalSelection(assets) {
    if (this.props.initalSelectedImageIndex !== undefined) {
      const image = assets[this.props.initalSelectedImageIndex];
      this.state.selected.push(image);
      this.props.onSelectedImagesChanged(this.state.selected, image);
    }
  }

  _appendImages(data, resetState) {
    if (data.assets.length > 0) {
      const dataSource = (resetState === true ? [] :  (this.state.dataSource || []));
      this.setState({
        images : this.state.images.concat(data.assets),
        noMore : data.includesLastAsset,
        dataSource : this.appendToState(dataSource, data.assets, this.props.imagesPerRow),
        shouldUpdate : this.guid()
      });
    }
  }

  appendToState(dataSource, newAssets, imagesPerRow) {
    let columnsAdded = 0;
    const lastRow = dataSource[dataSource.length - 1];
    if (lastRow && lastRow.rowData.length < imagesPerRow) {
      for (let i = (lastRow.rowData.length); i < imagesPerRow; i++) {
        lastRow.rowData.push(newAssets[columnsAdded]);
        columnsAdded++;
      }
      lastRow.rowData = [...lastRow.rowData];
    }
    const previousLength = (dataSource && dataSource.length) || 0;
    const newRows = newAssets.filter((item, index) => index >= columnsAdded).reduce((newRows, image, index) => {
      if (index % imagesPerRow == 0 && index !== 0) {
        newRows.push({
          rowKey: newRows.length + previousLength,
          rowData: []
        });
      };
      newRows[newRows.length - 1].rowData.push(image);
      return newRows;
    }, [
      {
        rowKey: previousLength,
        rowData: []
      }
    ]);
    return dataSource.concat(newRows);
  }

  guid() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  }

  renderScrollView(props) {
    return (
      <ScrollView
        scrollsToTop={true}
        bounces={this.state.bounces}
        onTouchMove={this.scrollViewPanDelegatorBound.onTouchMove}
        onTouchEnd={this.scrollViewPanDelegatorBound.onTouchEnd}
        onTouchStart={this.scrollViewPanDelegatorBound.onTouchStart}
        {...props}
        style={this.props.scrollViewStyle}
        scrollEventThrottle={16}
        decelerationRate='normal'></ScrollView>
    );
  }

  renderFooter() {
    return (
      <ActivityIndicator style={styles.activityIndicator}></ActivityIndicator>
    )
  }

  renderListView() {
    if (!this.state.dataSource) {
      return <ActivityIndicator style={styles.spinner}/>;
    }
    return (
      <WindowedListView
        renderWindowBoundaryIndicator={this.renderFooter.bind(this)}
        ref={wlv => this.wlv = wlv}
        onScroll={this.onScroll.bind(this)}
        disableIncrementalRendering={true}
        renderScrollComponent={this.renderScrollView.bind(this)}
        initialNumToRender={30}
        numToRenderAhead={40}
        maxNumToRender={500}
        shouldUpdateToken={this.state.shouldUpdate}
        onViewableRowsChanged={(e) => {
        if (e[e.length - 1] >= (this.state.dataSource.length - 60)) {
          this._onEndReachedDebounce();
        }
      }}
        data={this.state.dataSource}
        renderRow={this._renderRow.bind(this)}></WindowedListView>
    );
  }

  render() {
    const {imageMargin, backgroundColor} = this.props;
    return (
      <View
        style={[
        styles.wrapper, {
          padding: imageMargin,
          paddingRight: 0,
          width: this.props.window.width
        },
        this.props.style
      ]}>
        {this.renderListView()}
      </View>
    );
  }

  _renderImage(item, rowIndex, rowColumn, rowData) {
    let isSelected = false;
    for (let i = 0; i < this.state.selected.length; i++) {
      if (this.state.selected[i].uri === item.uri) {
        isSelected = true;
        break;
      }
    }
    let cellStyles = this.state.cellStyles;
    let lastItemInRow = (rowColumn % this.props.imagesPerRow) === this.props.imagesPerRow -1;
    return (
      <TouchableOpacity
        activeOpacity={1.0}
        key={item.uri}
        style={[cellStyles.cellMargin, {
          paddingRight : lastItemInRow ? 0 : this.props.imageMargin
        }]}
        onPress={() => this._selectImage(item, rowIndex, rowData)}>
        <Image source={item.image} style={cellStyles.imageSize}>
          {isSelected
            ? <View style={[cellStyles.imageSize, styles.selectedImage]}></View>
            : null}
        </Image>
      </TouchableOpacity>
    );
  }

  _renderRow(rowData, unknown, rowIndex) {
    if (rowData === undefined) {
      return null;
    }
    var items = rowData.filter(x => !!x).map((item, rowColumn) => this._renderImage(item, rowIndex, rowColumn, rowData));
    return (
      <View style={styles.row}>
        {items}
      </View>
    );
  }

  _onEndReached() {
    if (!this.state.noMore) {
      this.fetch();
    }
  }

  _selectImage(image, rowIndex, rowData) {
    var {maximum, imagesPerRow, onSelectedImagesChanged} = this.props;

    var selected = this.state.selected,
      index = this._arrayObjectIndexOf(selected, 'uri', image.uri);

    if (index >= 0 && !this.props.replaceSelection) {
      selected.splice(index, 1);
    } else {
      if (selected.length < maximum) {
        selected.push(image);
        image.selected = true;
      } else if (this.props.replaceSelection) {
        const itemToRemove = selected[0];
        selected.splice(0, 1);
        for (var i = 0; i < this.state.dataSource.length; i++) {
          const row = this.state.dataSource[i];
          let rowFound = false;
          for (var j = 0; j < row.rowData.length; j++) {
            const item = row.rowData[j];
            if (item === itemToRemove) {
              this.markRowForRerender(i);
              rowFound = true;
              break;
            }
          }
          if (rowFound) {
            break;
          }
        }
        this._selectImage(image, rowIndex, rowData);
      }
    }
    this.markRowForRerender(rowIndex);
    this.setState({selected: selected, shouldUpdate: this.guid()});
    onSelectedImagesChanged(this.state.selected, image);
    this.onScrollAdjustmentOnSelect(rowIndex);
  }

  onScrollAdjustmentOnSelect(rowIndex) {
    const imageWidthMarginSize = this.getImageWithMarginHeight();
    const rowScrollPosition = this.getRowIndexScrollTop(rowIndex, imageWidthMarginSize);
    if (this.props.scrollToRowOnSelection) {
      this.scrollToRow(rowIndex, rowScrollPosition);
    } else {
      if (rowScrollPosition < this.lastContentOffset.y) {
        this.scrollToRow(rowIndex, rowScrollPosition);
      }
      if ((rowScrollPosition + imageWidthMarginSize) > (this.props.scrollViewStyle.height + this.lastContentOffset.y)) {
        this.scrollToRow(rowIndex, rowScrollPosition - this.props.scrollViewStyle.height + imageWidthMarginSize);
      }
    }
  }

  onScroll(e) {
    this.lastContentOffset = e.nativeEvent.contentOffset;
    this.scrollViewPanDelegatorBound.onScroll(e);
  }

  getImageWithMarginHeight() {
    const {imageMargin} = this.props;
    return ((this._imageSize) + imageMargin);
  }

  getRowIndexScrollTop(rowIndex, imageWidthMarginSize) {
    return ((imageWidthMarginSize !== undefined
      ? imageWidthMarginSize
      : this.getImageWithMarginHeight()) * rowIndex);
  }

  scrollToRow(rowIndex, predefinedYValye, animated = true) {
    const scrollResponder = this.wlv && this.wlv.getScrollResponder();
    if (scrollResponder) {
      scrollResponder.scrollTo({
        x: 0,
        y: predefinedYValye !== undefined
          ? predefinedYValye
          : this.getRowIndexScrollTop(rowIndex),
        animated: animated
      });
    }
  }

  markRowForRerender(rowIndex) {
    this.state.dataSource[rowIndex].rowData = [...this.state.dataSource[rowIndex].rowData];
  }

  _arrayObjectIndexOf(array, property, value) {
    return array.map((o) => {
      return o[property];
    }).indexOf(value);
  }

}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1
  },
  row: {
    flexDirection: 'row',
    flex: 1
  },
  marker: {
    position: 'absolute',
    top: 5,
    backgroundColor: 'transparent',
    width: 25,
    height: 25,
    right: 10
  },
  spinner: {
    marginTop: 20
  },
  selectedImage: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)'
  },
  activityIndicator : {
    marginTop : 20
  }
})

CameraRollPicker.propTypes = {
  maximum: React.PropTypes.number,
  imagesPerRow: React.PropTypes.number,
  imageMargin: React.PropTypes.number,
  containerWidth: React.PropTypes.number,
  onSelectedImagesChanged: React.PropTypes.func,
  selected: React.PropTypes.array,
  selectedMarker: React.PropTypes.element,
  backgroundColor: React.PropTypes.string
}

CameraRollPicker.defaultProps = {
  maximum: 15,
  imagesPerRow: 3,
  imageMargin: 5,
  backgroundColor: 'white',
  selected: []
}

export default CameraRollPicker;