import {View, Text, StyleSheet, PixelRatio, TouchableOpacity} from 'react-native';
import React, { Component } from 'react';
import Icon from 'react-native-vector-icons/Ionicons';
export default class PhotoManagerHeader extends Component {

  render() {
    const fontStyle = {fontFamily : this.props.font || 'Helvetica'};

    return (
      <View style={[styles.topBar, this.props.style, {
        height: this.props.height
      }]}>
        <TouchableOpacity
          style={[styles.buttonArea, styles.leftButtonArea]}
          onPress={() => this.props.onPress('library')}>
          <Text
            style={[
            styles.button, fontStyle, this.props.selectedTab === 'library'
              ? styles.buttonSelected
              : null
          ]}>{this.props.libraryDisplayName}</Text>
        </TouchableOpacity>
        <View style={{flex : 1}}></View>
        <TouchableOpacity
          style={[styles.buttonArea, styles.buttonArea]}
          onPress={() => this.props.onPress('photo')}>
          <Text
            style={[
            styles.button, fontStyle, this.props.selectedTab === 'photo'
              ? styles.buttonSelected
              : null
          ]}>{this.props.photoDisplayName}</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  topBar: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 45
  },
  title: {
    flex: 1,
    fontSize: 15,
    textAlign: 'center',
    margin: 10
  },
  buttonArea: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start'
  },
  button: {
    color: '#999999',
    fontSize: 15,
    textAlign: 'center'
  },
  buttonSelected: {
    color: 'black',
    fontWeight : 'bold'
  },
  buttonArea: {
    height : 45,
    paddingHorizontal: 15,
    justifyContent: 'center'
  },
  leftButtonArea: {
  //  flex: 1
  },
  centerButton: {
    //  flex: 1
  }
});