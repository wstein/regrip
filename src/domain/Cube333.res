// Minimal pure 3x3x3 state used by the session's default solve detector.
// Protocol adapters supply canonical URFDLB facelets; move application is kept
// outside this value until a consumer needs an incremental move-only detector.

let solvedFacelets = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"

type t = {facelets: string}

let fromFacelets = (facelets: string): t => {facelets: facelets}

let facelets = (cube: t): string => cube.facelets

let isSolved = (cube: t): bool => cube.facelets == solvedFacelets
