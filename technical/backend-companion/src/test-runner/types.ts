export type RunContext = Record<string, unknown>;

export type WaitPolicy = {
  maxSeconds?: number;
  pollEveryMs?: number;
  retryCount?: number;
};

export type ApiRequestStep = {
  step: number;
  actor?: string;
  actionType: "apiRequest";
  method: string;
  endpoint: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  authType?: string;
  requiredPayloadFields?: string[];
  payloadRules?: Record<string, unknown>;
  payload?: Record<string, unknown> | Array<unknown> | string | null;
  storeResponseFields?: string[];
  storeAs?: string;
  expectedBehavior?: unknown;
  notes?: unknown;
  description?: string;
  layman?: string;
};

export type ApiResponseStep = {
  step: number;
  actor?: string;
  actionType: "apiResponse";
  expectedStatus?: number;
  expectedResponseFields?: string[];
  expectedOptionalFields?: string[];
  expectedBehavior?: unknown;
  notes?: unknown;
  description?: string;
  layman?: string;
};

export type DbVerificationStep = {
  step: number;
  actor?: string;
  actionType: "dbVerification";
  target: string;
  expectedRows?: number;
  expectedFields?: Record<string, unknown>;
  query?: string;
  expectedBehavior?: unknown;
  notes?: unknown;
  description?: string;
  layman?: string;
};

export type InformationalStep = {
  step: number;
  actor?: string;
  actionType:
    | "authorization"
    | "validation"
    | "allocation"
    | "dbTransaction"
    | "responseValidation";
  expectedBehavior?: unknown;
  notes?: unknown;
  description?: string;
  layman?: string;
};

export type ExternalCheckStep = {
  step: number;
  actor?: string;
  actionType: "externalCheck";
  endpoint?: string;
  validateEmailTo: string;
  extractTokenFromEmail?: boolean;
  storeAs?: string;
  expectedBehavior?: unknown;
  notes?: unknown;
  description?: string;
  layman?: string;
};

export type DbQueryStep = {
  step: number;
  actor?: string;
  actionType: "dbQuery";
  target?: string;
  where?: {
    field: string;
    value: string;
  };
  expectedBehavior?: unknown;
  notes?: unknown;
  description?: string;
  layman?: string;
};

export type StepDefinition =
  | ApiRequestStep
  | ApiResponseStep
  | DbVerificationStep
  | InformationalStep
  | ExternalCheckStep
  | DbQueryStep;

export type SeedVenue = {
  entity: "venue";
  values: {
    id: string;
    name: string;
    address?: string;
    venueType: string;
    latitude: number;
    longitude: number;
    operatingHoursStart?: string;
    operatingHoursEnd?: string;
  };
};

export type SeedDefinition = SeedVenue;

export type ApiAssertion = {
  step: number;
  statusCode?: number;
  requiredKeys?: string[];
  bodyFields?: Record<string, unknown>;
};

export type ExternalAssertion = {
  step: number;
  description?: string;
  checks?: string[];
};

export type DbAssertion = {
  step: number;
  description?: string;
  checks?: string[];
};

export type AssertionsDefinition = {
  api?: ApiAssertion[];
  external?: ExternalAssertion[];
  db?: DbAssertion[];
  mustNotOccur?: string[];
};

export type TestDefinition = {
  testId: string;
  type?: string;
  scenarioName?: string;
  steps: StepDefinition[];
  seedData?: SeedDefinition[];
  waitPolicy?: WaitPolicy;
  assertions?: AssertionsDefinition;
};

export type EnvironmentCheck = {
  apiServer: string;
  mailpit: string;
  database: string;
};

export type ServiceHitLogEntry = {
  step: number;
  target: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  result: string;
  statusCode?: number;
};

export type StepResult = {
  step: number;
  result: string;
  observed: Record<string, unknown>;
  statusCode?: number;
  actor?: string;
  actionType?: string;
  description?: string;
  layman?: string;
  serviceHit?: ServiceHitLogEntry;
};

export type AssertionSummary = {
  api: string;
  db: string;
  external: string;
  mustNotOccur: string;
};

export type TestRunResult = {
  runId: string;
  testId: string;
  status: string;
  startedAt: string;
  endedAt: string;
  environmentCheck: EnvironmentCheck;
  serviceHitLog: ServiceHitLogEntry[];
  stepResults: StepResult[];
  assertionSummary: AssertionSummary;
  failures: Array<Record<string, unknown>>;
  cleanup: Record<string, unknown>;
};
