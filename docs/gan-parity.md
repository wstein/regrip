# GAN parity matrix

The transport identifies each GAN protocol generation explicitly. Regrip core treats
those protocol IDs through one common session contract while retaining the Gen4/i4
profile specialization.

| Generation | Transport protocol | Core profile             | Initial state contract      | Capture coverage                  |
| ---------- | ------------------ | ------------------------ | --------------------------- | --------------------------------- |
| Gen1       | `gan-gen1`         | `gan-gen2`               | facelets, battery           | hardware pending                  |
| Gen2       | `gan-gen2`         | `gan-gen2`               | hardware, facelets, battery | committed transport capture       |
| Gen3       | `gan-gen3`         | `gan-gen2`               | hardware, facelets, battery | hardware pending                  |
| Gen4       | `gan-gen4`         | `gan-gen4` for `GANi4_*` | hardware, facelets, battery | committed redacted profile replay |

`ganParityMatrix.test.ts` enforces profile selection, capability-gated initial
commands, normalized battery/move delivery, and disconnect behavior for all four
rows. Gen1 and Gen3 still need representative hardware captures before transport-level
parity can be called complete; this matrix makes that remaining gap explicit.
