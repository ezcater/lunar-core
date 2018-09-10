const {
  buildSchemaFromTypeDefinitions,
  //  addMockFunctionsToSchema
} = require('graphql-tools');
const {graphql} = require('graphql');
const {addMockFunctionsToSchema, removeMockFunctionsFromSchema} = require('./');

const schemaString = `
  type Foo {
    id: ID!
    stringValue: String
    boolValue: Boolean
    intValue: Int
    bar: Bar
  }
  type Bar {
    id: ID!
    stringValue: String
  }
  type RootQuery {
    intValue: Int
    stringValue: String
    boolValue: Boolean
    fooInstance: Foo
    fooById(id: ID!): Foo
  }
  type RootMutation {
    returnIntArgument(i: Int): Int
    returnStringArgument(s: String): String
  }
  schema {
    query: RootQuery
    mutation: RootMutation
  }
`;

describe('Mock', () => {
  it('mocks the default types for you', () => {
    const schema = buildSchemaFromTypeDefinitions(schemaString);
    addMockFunctionsToSchema({schema});
    const testQuery = `{
      intValue
      stringValue
      boolValue
    }`;
    return graphql(schema, testQuery).then(({data: {intValue, stringValue, boolValue}}) => {
      expect(intValue).toBeGreaterThanOrEqual(-1000);
      expect(intValue).toBeLessThanOrEqual(1000);
      expect(typeof stringValue).toEqual('string');
      expect(typeof boolValue).toEqual('boolean');
    });
  });

  it('mocks object types', () => {
    const schema = buildSchemaFromTypeDefinitions(schemaString);
    addMockFunctionsToSchema({schema});
    const testQuery = `{
      fooInstance {
        id
        bar {
          id
        }
      }
    }`;
    return graphql(schema, testQuery).then(({data: {fooInstance}}) => {
      expect(typeof fooInstance).toEqual('object');
      expect(typeof fooInstance.bar).toEqual('object');
    });
  });

  it('lets you tailor mocks with canned values', async () => {
    const schema = buildSchemaFromTypeDefinitions(schemaString);
    const mocks = {
      Foo: () => ({
        stringValue: 'baz',
      }),
    };
    addMockFunctionsToSchema({schema, mocks});
    const testQuery = `{
      fooInstance {
        stringValue
      }
    }`;
    const {
      data: {
        fooInstance: {stringValue},
      },
    } = await graphql(schema, testQuery);
    expect(stringValue).toEqual('baz');
  });

  describe('when querying using the same path twice', () => {
    it('uses consistent canned values', async () => {
      const schema = buildSchemaFromTypeDefinitions(schemaString);
      const mocks = {
        Foo: () => ({
          stringValue: 'baz',
        }),
      };
      addMockFunctionsToSchema({schema, mocks});
      const testQuery = `{
        fooInstance {
          id
          stringValue
        }
      }`;
      const {
        data: {fooInstance},
      } = await graphql(schema, testQuery);
      const {
        data: {fooInstance: fooInstance2},
      } = await graphql(schema, testQuery);
      expect(fooInstance.stringValue).toEqual('baz');
      expect(fooInstance).toEqual(fooInstance2);
    });

    it('uses consistent mocked values', async () => {
      const schema = buildSchemaFromTypeDefinitions(schemaString);
      addMockFunctionsToSchema({schema});
      const testQuery = `{
        fooInstance {
          id
          stringValue
        }
      }`;
      const {
        data: {fooInstance},
      } = await graphql(schema, testQuery);
      const {
        data: {fooInstance: fooInstance2},
      } = await graphql(schema, testQuery);
      expect(fooInstance).toEqual(fooInstance2);
    });
  });

  it('lets you remove previously mocked values', async () => {
    const schema = buildSchemaFromTypeDefinitions(schemaString);
    const mocks = {
      Foo: () => ({
        stringValue: 'baz',
      }),
    };
    addMockFunctionsToSchema({schema, mocks});
    const testQuery = `{
      fooInstance {
        stringValue
      }
    }`;
    await graphql(schema, testQuery);

    removeMockFunctionsFromSchema({schema, mocks});

    const {
      data: {fooInstance},
    } = await graphql(schema, testQuery);
    expect(fooInstance).toEqual(null);
  });

  describe('multiple calls to add mocks', () => {
    it('replaces the previously defined mocks with the default auto-mocking behavior', async () => {
      const schema = buildSchemaFromTypeDefinitions(schemaString);
      const fooMocks = {
        Foo: () => ({
          stringValue: 'foo',
        }),
      };
      const barMocks = {
        Bar: () => ({
          stringValue: 'bar',
        }),
      };
      addMockFunctionsToSchema({schema, mocks: fooMocks});
      addMockFunctionsToSchema({schema, mocks: barMocks});
      const testQuery = `{
        fooInstance {
          id
          stringValue
          bar {
            stringValue
          }
        }
      }`;
      const {
        data: {fooInstance},
      } = await graphql(schema, testQuery);
      expect(fooInstance.stringValue).toEqual('Hello World');
      expect(fooInstance.bar.stringValue).toEqual('bar');
    });
  });

  describe('combining mocks', () => {
    it("let's you combine mocks for different types", async () => {
      const schema = buildSchemaFromTypeDefinitions(schemaString);
      const fooMocks = {
        Foo: () => ({
          stringValue: 'foo',
        }),
      };
      const barMocks = {
        Bar: () => ({
          stringValue: 'bar',
        }),
      };

      const mocks = [fooMocks, barMocks];

      addMockFunctionsToSchema({schema, mocks});
      const testQuery = `{
        fooInstance {
          id
          stringValue
          bar {
            stringValue
          }
        }
      }`;
      const {
        data: {fooInstance},
      } = await graphql(schema, testQuery);
      expect(fooInstance.stringValue).toEqual('foo');
      expect(fooInstance.bar.stringValue).toEqual('bar');
    });

    it("let's you combine mutations from separately defined mocks", async () => {
      const schema = buildSchemaFromTypeDefinitions(schemaString);
      const left = {
        RootMutation: () => ({
          returnStringArgument: (obj, args) => args.s,
        }),
      };
      const right = {
        RootMutation: () => ({
          returnIntArgument: (obj, args) => args.i,
        }),
      };

      const mocks = [left, right];

      addMockFunctionsToSchema({schema, mocks});
      const testQuery = `
        mutation {
          returnStringArgument(s: "adieu")
          returnIntArgument(i: 6)
        }
      `;

      const {
        data: {returnStringArgument, returnIntArgument},
      } = await graphql(schema, testQuery);

      expect(returnStringArgument).toEqual('adieu');
      expect(returnIntArgument).toEqual(6);
    });

    it('does not stomp on previously returned mock values', async () => {
      const schema = buildSchemaFromTypeDefinitions(schemaString);
      const left = {
        Foo: () => ({
          stringValue: 'baz',
        }),
      };
      const right = {
        RootMutation: () => ({
          returnIntArgument: (obj, args) => args.i,
        }),
      };

      addMockFunctionsToSchema({schema, mocks: [left]});

      const testQuery = `{
        fooInstance {
          id
          stringValue
        }
      }`;

      const {
        data: {fooInstance},
      } = await graphql(schema, testQuery);

      addMockFunctionsToSchema({schema, mocks: [left, right]});

      const {
        data: {fooInstance: fooInstance2},
      } = await graphql(schema, testQuery);

      expect(fooInstance).toEqual(fooInstance2);
    });

    describe('query mock deep merge', () => {
      it('combines the results for multiple mocks into one return object', async () => {
        const schema = buildSchemaFromTypeDefinitions(schemaString);
        const fooMocksBase = {
          Foo: () => ({
            stringValue: 'foo',
            boolValue: true,
            intValue: 54,
          }),
        };
        const fooMocksOverrideOne = {
          Foo: () => ({
            stringValue: 'bar',
          }),
        };
        const fooMocksOverrideTwo = {
          Foo: () => ({
            intValue: 56,
          }),
        };
        addMockFunctionsToSchema({
          schema,
          mocks: [fooMocksBase, fooMocksOverrideOne, fooMocksOverrideTwo],
        });
        const testQuery = `{
        fooInstance {
          id
          stringValue
          boolValue
          intValue
        }
      }`;
        const {
          data: {fooInstance},
        } = await graphql(schema, testQuery);
        expect(fooInstance.stringValue).toEqual('bar');
        expect(fooInstance.boolValue).toEqual(true);
        expect(fooInstance.intValue).toEqual(56);
      });

      it('nullifies the object if a follow-on mock sets it to null', async () => {
        const schema = buildSchemaFromTypeDefinitions(schemaString);
        const fooMocksBase = {
          Foo: () => ({
            stringValue: 'foo',
            boolValue: true,
            intValue: 54,
          }),
        };
        const fooMocksOverrideOne = {
          Foo: () => null,
        };
        addMockFunctionsToSchema({
          schema,
          mocks: [fooMocksBase, fooMocksOverrideOne],
        });
        const testQuery = `{
          fooInstance {
            id
            stringValue
            boolValue
            intValue
          }
        }`;
        const {
          data: {fooInstance},
        } = await graphql(schema, testQuery);
        expect(fooInstance).toBeNull();
      });
    });
  });

  describe('extended context', () => {
    it("provides find function to query resolver's context argument", async () => {
      const schema = buildSchemaFromTypeDefinitions(schemaString);
      const fooResolver = jest.fn(() => ({
        stringValue: 'foo',
      }));
      const mocks = {
        Foo: fooResolver,
      };
      addMockFunctionsToSchema({schema, mocks});
      const testQuery = `{
        fooInstance {
          stringValue
        }
      }`;
      await graphql(schema, testQuery);

      expect(typeof fooResolver.mock.calls[0][2].find).toBeDefined();
    });

    it("provides find function to mutation resolver's context argument", async () => {
      const schema = buildSchemaFromTypeDefinitions(schemaString);
      const mutationResolver = jest.fn((obj, args) => args.s);
      const mocks = {
        RootMutation: () => ({returnStringArgument: mutationResolver}),
      };
      addMockFunctionsToSchema({schema, mocks});
      const testQuery = `
        mutation {
          returnStringArgument(s: "adieu")
        }
      `;

      await graphql(schema, testQuery);

      expect(typeof mutationResolver.mock.calls[0][2].find).toBeDefined();
    });
  });
});
