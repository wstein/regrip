let format = (ms: float): string => {
  let total = Math.trunc(ms)
  let minutes = Math.trunc(total /. 60000.)
  let rem = total -. minutes *. 60000.
  let seconds = Math.trunc(rem /. 1000.)
  let millis = Math.trunc(rem -. seconds *. 1000.)
  `${minutes->Float.toInt->Int.toString}:${seconds
    ->Float.toInt
    ->Int.toString
    ->String.padStart(2, "0")}.${millis->Float.toInt->Int.toString->String.padStart(3, "0")}`
}
