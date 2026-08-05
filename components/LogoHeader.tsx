import { Image, Platform, StyleSheet, View } from "react-native";
import { Dimensions } from "react-native";

const { width: screenWidth } = Dimensions.get('window');

const LogoHeader = () => (
    <View style={styles.logoContainer}>
        <Image
        source={require('@/assets/images/zeal-head.png')}
        style={styles.logoImage}
        resizeMode='contain'
        />
    </View>
)

const styles = StyleSheet.create({
  logoContainer: {
    paddingHorizontal: screenWidth * 0.08,
    paddingTop: Platform.OS === 'ios' ? screenWidth * 0.06 : 52,
    paddingBottom: screenWidth * 0.04,
  },
  logoImage: {
    width: screenWidth * 0.5,
    height: 82,
  },
})

export default LogoHeader;
