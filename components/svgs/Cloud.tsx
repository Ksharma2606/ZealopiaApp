import * as React from "react"
import Svg, { Ellipse } from "react-native-svg"

function SvgComponent(props) {
  return (
    <Svg
      width={261}
      height={116}
      viewBox="0 0 261 116"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <Ellipse cx={117} cy={58} rx={71} ry={58} fill="#fff" />
      <Ellipse cx={199} cy={53.5} rx={62} ry={42.5} fill="#fff" />
      <Ellipse cx={58.5} cy={68} rx={58.5} ry={35} fill="#fff" />
    </Svg>
  )
}

export default SvgComponent
