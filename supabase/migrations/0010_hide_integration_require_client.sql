-- 0010: integration_require_client() es interna (la llaman las funciones de la API,
-- que corren como su dueño). No necesita estar expuesta en /rest/v1/rpc
-- (aviso del linter de Supabase: authenticated_security_definer_function_executable).
revoke execute on function integration_require_client() from authenticated;
