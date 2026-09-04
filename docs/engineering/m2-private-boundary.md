# M2 Private Boundary

`private.question_keys` and `private.staff_roles` are excluded from Data API schemas and denied to browser roles. Browser clients never receive normal-table access to answer keys or staff authority. This boundary is verified through pgTAP privilege tests before acceptance.
