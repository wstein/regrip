@module("@wstein/regrip-core/domain/CubeFacelets.res.mjs")
external solvedFacelets: string = "solvedFacelets"

@module("@wstein/regrip-core/domain/CubeFacelets.res.mjs")
external isSolvedFacelets: string => bool = "isSolvedFacelets"

if !isSolvedFacelets(solvedFacelets) {
  JsError.throwWithMessage("the packaged solved state must be solved")
}
