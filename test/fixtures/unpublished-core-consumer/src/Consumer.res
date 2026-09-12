@module("@wstein/regrip-core/domain/CubeFacelets")
external solvedFacelets: string = "solvedFacelets"

@module("@wstein/regrip-core/domain/CubeFacelets")
external isSolvedFacelets: string => bool = "isSolvedFacelets"

if !isSolvedFacelets(solvedFacelets) {
  JsError.throwWithMessage("the packaged solved state must be solved")
}
