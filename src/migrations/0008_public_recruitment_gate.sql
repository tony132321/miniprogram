CREATE TABLE public_recruitment_gate (
  id integer PRIMARY KEY CHECK (id = 1),
  status text NOT NULL CHECK (status IN ('OPEN','CLOSED')),
  reason text NOT NULL,
  changed_by text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public_recruitment_gate(id,status,reason,changed_by) VALUES (1,'OPEN','初始开放','system');
