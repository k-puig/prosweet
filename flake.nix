{
  description = "prosweet dev env";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = { self, nixpkgs }: 
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in {
      devShells.x86_64-linux.default = pkgs.mkShell {
        buildInputs = with pkgs; [
          # TypeScript deps
          bun
          nodejs_24
          prisma
          prisma-engines
          openssl_3 # needed for prisma

          # DB deps
          ephemeralpg
          postgresql

          # Calendar
          radicale
        ];
        shellHook = with pkgs; ''
          echo "Welcome to the methylphenidate dev environment!"
          export NIX_LDFLAGS="''${NIX_LDFLAGS/-rpath $out\/lib /}"
          export LD_LIBRARY_PATH="${stdenv.cc.cc.lib}"/lib
          export PRISMA_SCHEMA_ENGINE_BINARY="${prisma-engines}/bin/migration-engine"
          export PRISMA_QUERY_ENGINE_BINARY="${prisma-engines}/bin/query-engine"
          export PRISMA_QUERY_ENGINE_LIBRARY="${prisma-engines}/lib/libquery_engine.node"
          export PRISMA_INTROSPECTION_ENGINE_BINARY="${prisma-engines}/bin/introspection-engine"
          export PRISMA_FMT_BINARY="${prisma-engines}/bin/prisma-fmt"
          export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING="1";

        '';
      };
    };
}
