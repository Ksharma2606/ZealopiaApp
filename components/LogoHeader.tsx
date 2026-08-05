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
    padding: screenWidth * 0.08,
    paddingTop: Platform.OS === 'ios' ? screenWidth * 0.05 : 70,
  },
  logoImage: {
    width: screenWidth * 0.6,
    height: 'auto',
    minHeight: 100,
  },
})

export default LogoHeader;
