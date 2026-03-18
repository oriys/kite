-- gRPC source type enum
CREATE TYPE grpc_source_type AS ENUM ('proto_file', 'proto_zip', 'nacos', 'etcd');

-- gRPC sources table
CREATE TABLE grpc_sources (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type grpc_source_type NOT NULL,
  source_config JSONB,
  raw_content TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX grpc_sources_workspace_id_idx ON grpc_sources(workspace_id);

-- gRPC services table
CREATE TABLE grpc_services (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES grpc_sources(id) ON DELETE CASCADE,
  package_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX grpc_services_source_id_idx ON grpc_services(source_id);

-- gRPC methods table
CREATE TABLE grpc_methods (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES grpc_services(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES grpc_sources(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  input_type JSONB NOT NULL,
  output_type JSONB NOT NULL,
  client_streaming BOOLEAN NOT NULL DEFAULT FALSE,
  server_streaming BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX grpc_methods_service_id_idx ON grpc_methods(service_id);
CREATE INDEX grpc_methods_source_id_idx ON grpc_methods(source_id);
