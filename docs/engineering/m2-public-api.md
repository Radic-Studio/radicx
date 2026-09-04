# M2 Public API Exposure

The configured Data API exposes `public` and `graphql_public`, not `private`. Public-schema reachability is further restricted by explicit grants and RLS. Private schema exclusion is treated as defense in depth, not a substitute for object privileges.
