// Format a millisecond duration as "m:ss.mmm" (matching the pre-port
// makeTimeFromTimestamp + template string in index.ts).
let format = (ms: float): string => {
  let total = Math.trunc(ms)
  let minutes = Math.trunc(total /. 60000.)
  let rem = total -. minutes *. 60000.
  let seconds = Math.trunc(rem /. 1000.)
  let millis = Math.trunc(rem -. seconds *. 1000.)
  let mm = minutes->Float.toInt->Int.toString
  let ss = seconds->Float.toInt->Int.toString->String.padStart(2, "0")
  let mmm = millis->Float.toInt->Int.toString->String.padStart(3, "0")
  `${mm}:${ss}.${mmm}`
}
