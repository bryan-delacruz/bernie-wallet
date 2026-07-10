-- Marca si el usuario ya pasó por el onboarding del primer login.
-- NULL = aún no; timestamp = completado (aunque haya omitido elegir banco).
alter table users add column onboarded_at timestamptz;
