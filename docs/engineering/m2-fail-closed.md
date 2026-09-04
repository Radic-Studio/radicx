# M2 Fail-Closed Defaults

Default privileges are revoked for future public/private objects so later migrations must opt into access explicitly. This reduces the risk that a newly created table/function becomes browser-accessible merely because historical Supabase defaults granted it automatically.
