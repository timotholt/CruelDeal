use serde_json::Value;

pub const PROTOCOL_SCHEMA_JSON: &str =
    include_str!("../../../protocol/schema/cruel-deal-protocol-v1.schema.json");

/// Rust protocol types are generated directly from the same checked-in schema
/// consumed by the TypeScript runtime validator.
pub mod generated {
    typify::import_types!(schema = "../../protocol/schema/cruel-deal-protocol-v1.schema.json");
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProtocolValidationIssue {
    pub path: String,
    pub message: String,
}

pub fn protocol_schema() -> Value {
    serde_json::from_str(PROTOCOL_SCHEMA_JSON)
        .expect("checked-in protocol schema must be valid JSON")
}

pub fn validate_protocol_message(instance: &Value) -> Result<(), Vec<ProtocolValidationIssue>> {
    let schema = protocol_schema();
    let validator = jsonschema::draft202012::new(&schema)
        .expect("checked-in protocol schema must compile as JSON Schema 2020-12");
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    const CONFORMANCE_FIXTURES_JSON: &str =
        include_str!("../../../protocol/fixtures/protocol-v1-conformance.json");

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
    fn canonical_schema_compiles_as_draft_2020_12() {
        let schema = protocol_schema();
        jsonschema::draft202012::new(&schema).expect("canonical protocol schema must compile");
    }

    #[test]
    fn rust_agrees_with_every_shared_conformance_fixture() {
        let suite: FixtureSuite = serde_json::from_str(CONFORMANCE_FIXTURES_JSON)
            .expect("shared conformance fixture file must be valid JSON");
        assert_eq!(suite.protocol_version, 1);

        for case in suite.cases {
            let result = validate_protocol_message(&case.value);
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
