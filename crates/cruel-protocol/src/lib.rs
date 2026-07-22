use serde_json::Value;

pub const AUTHORITY_SCHEMA_JSON: &str =
    include_str!("../../../protocol/schema/cruel-deal-authority-record-v2.schema.json");
pub const PLAYER_WIRE_SCHEMA_JSON: &str =
    include_str!("../../../protocol/schema/cruel-deal-player-wire-v2.schema.json");

/// Rust protocol types are generated directly from the same checked-in schema
/// consumed by the TypeScript runtime validator.
pub mod authority_generated {
    typify::import_types!(schema = "../../protocol/schema/cruel-deal-authority-record-v2.schema.json");
}

pub mod player_wire_generated {
    typify::import_types!(schema = "../../protocol/schema/cruel-deal-player-wire-v2.schema.json");
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProtocolValidationIssue {
    pub path: String,
    pub message: String,
}

pub fn authority_schema() -> Value {
    serde_json::from_str(AUTHORITY_SCHEMA_JSON)
        .expect("checked-in authority schema must be valid JSON")
}

pub fn player_wire_schema() -> Value {
    serde_json::from_str(PLAYER_WIRE_SCHEMA_JSON)
        .expect("checked-in player wire schema must be valid JSON")
}

fn validate(
    schema: &Value,
    instance: &Value,
) -> Result<(), Vec<ProtocolValidationIssue>> {
    let validator = jsonschema::draft202012::new(&schema)
        .expect("checked-in schema must compile as JSON Schema 2020-12");
    let issues: Vec<_> = validator
        .iter_errors(instance)
        .map(|error| ProtocolValidationIssue {
            path: {
                let path = error.instance_path.to_string();
                if path.is_empty() {
                    "/".to_owned()
                } else {
                    path
                }
            },
            message: error.to_string(),
        })
        .collect();

    if issues.is_empty() {
        Ok(())
    } else {
        Err(issues)
    }
}

pub fn validate_authority_record_message(
    instance: &Value,
) -> Result<(), Vec<ProtocolValidationIssue>> {
    validate(&authority_schema(), instance)
}

pub fn validate_player_wire_message(
    instance: &Value,
) -> Result<(), Vec<ProtocolValidationIssue>> {
    validate(&player_wire_schema(), instance)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    const AUTHORITY_FIXTURES_JSON: &str =
        include_str!("../../../protocol/fixtures/authority-v2-conformance.json");
    const PLAYER_WIRE_FIXTURES_JSON: &str =
        include_str!("../../../protocol/fixtures/player-wire-v2-conformance.json");

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FixtureSuite {
        protocol_version: u64,
        cases: Vec<FixtureCase>,
    }

    #[derive(Debug, Deserialize)]
    struct FixtureCase {
        name: String,
        valid: bool,
        value: Value,
    }

    #[test]
    fn both_schemas_compile_as_draft_2020_12() {
        jsonschema::draft202012::new(&authority_schema())
            .expect("authority schema must compile");
        jsonschema::draft202012::new(&player_wire_schema())
            .expect("player wire schema must compile");
    }

    #[test]
    fn rust_agrees_with_both_shared_conformance_suites() {
        assert_suite(
            AUTHORITY_FIXTURES_JSON,
            validate_authority_record_message,
        );
        assert_suite(
            PLAYER_WIRE_FIXTURES_JSON,
            validate_player_wire_message,
        );
    }

    fn assert_suite(
        fixtures_json: &str,
        validator: fn(&Value) -> Result<(), Vec<ProtocolValidationIssue>>,
    ) {
        let suite: FixtureSuite = serde_json::from_str(fixtures_json)
            .expect("shared conformance fixture file must be valid JSON");
        assert_eq!(suite.protocol_version, 2);

        for case in suite.cases {
            let result = validator(&case.value);
            assert_eq!(
                result.is_ok(),
                case.valid,
                "fixture {:?} disagreed in Rust: {:?}",
                case.name,
                result,
            );
        }
    }
}
