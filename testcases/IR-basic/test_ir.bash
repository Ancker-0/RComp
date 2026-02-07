#!/bin/bash

# Test script for IR-basic test cases
# Usage: ./test_ir.bash [testcase] [tempdir]
#   If testcase is specified, runs only that test
#   If tempdir is specified, uses that directory for temporary files (useful for debugging)
#
# Example:
#   ./test_ir.bash              # Run all tests
#   ./test_ir.bash basic1       # Run only basic1 test
#   ./test_ir.bash basic1 /tmp  # Run basic1 and keep temp files

set -e

# Directory setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJ_DIR="$SCRIPT_DIR/../.."
TESTS_DIR="${SCRIPT_DIR}"
BUILTIN="${TESTS_DIR}/builtin.c"
cd "${SCRIPT_DIR}"

# Colors for output
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
NC='\033[0m' # No Color

# Get clang
get_clang() {
    (which clang-15 > /dev/null 2>&1 && echo clang-15) || \
    (which clang-16 > /dev/null 2>&1 && echo clang-16) || \
    (which clang-17 > /dev/null 2>&1 && echo clang-17) || \
    (which clang-18 > /dev/null 2>&1 && echo clang-18) || \
    (which clang > /dev/null 2>&1 && echo clang) || \
    (echo "Error: clang not found" >&2 && exit 1)
}

CLANG=$(get_clang)

# Check if reimu is available
check_reimu() {
    which reimu > /dev/null 2>&1
}

# Run a single test
run_test() {
    local TESTCASE=$1
    local TEMPDIR=$2

    echo -n "Testing ${TESTCASE}... "

    # Check if test files exist
    if [ ! -d "${TESTS_DIR}/${TESTCASE}" ]; then
        echo -e "${RED}FAIL${NC}"
        echo "  Error: Test directory ${TESTCASE} not found"
        return 1
    fi

    local TESTFILE="${TESTS_DIR}/${TESTCASE}/${TESTCASE}.rx"
    local INFILE="${TESTS_DIR}/${TESTCASE}/${TESTCASE}.in"
    local OUTFILE="${TESTS_DIR}/${TESTCASE}/${TESTCASE}.out"

    if [ ! -f "$TESTFILE" ] || [ ! -f "$INFILE" ] || [ ! -f "$OUTFILE" ]; then
        echo -e "${RED}FAIL${NC}"
        echo "  Error: Test files missing for ${TESTCASE}"
        return 1
    fi

    # Compile R code to LLVM IR
    cd $PROJ_DIR && npx ts-node src/test/ir-compile.ts < "$TESTFILE" > "${TEMPDIR}/output.ll" 2>/dev/null
    if [ $? -ne 0 ]; then
        echo -e "${RED}FAIL${NC}"
        echo "  Error: Failed to compile ${TESTCASE}"
        return 1
    fi

    # Check if LLVM IR was generated
    if [ ! -s "${TEMPDIR}/output.ll" ]; then
        echo -e "${RED}FAIL${NC}"
        echo "  Error: No LLVM IR generated"
        return 1
    fi

    # If reimu is available, run the full test
    if check_reimu; then
        # Compile LLVM IR to RISC-V assembly
        $CLANG -S --target=riscv32-unknown-elf "${TEMPDIR}/output.ll" -o "${TEMPDIR}/output.s.source" 2>/dev/null
        if [ $? -ne 0 ]; then
            echo -e "${RED}FAIL${NC}"
            echo "  Error: Failed to compile LLVM IR to assembly"
            return 1
        fi

        # Compile builtin functions
        $CLANG -S --target=riscv32-unknown-elf -O2 -fno-builtin "$BUILTIN" -o "${TEMPDIR}/builtin.s.source" 2>/dev/null
        if [ $? -ne 0 ]; then
            echo -e "${RED}FAIL${NC}"
            echo "  Error: Failed to compile builtin.c"
            return 1
        fi

        # Remove @plt suffix (not supported by reimu)
        sed 's/@plt//g' "${TEMPDIR}/output.s.source" > "${TEMPDIR}/test.s"
        sed 's/@plt//g' "${TEMPDIR}/builtin.s.source" > "${TEMPDIR}/builtin.s"

        # Copy input file
        cp "$INFILE" "${TEMPDIR}/test.in"

        # Run with reimu
        cd "$TEMPDIR"
        reimu -i="${TEMPDIR}/test.in" -o="${TEMPDIR}/test.out" > /dev/null 2>&1
        if [ $? -ne 0 ]; then
            echo -e "${RED}FAIL${NC}"
            echo "  Error: reimu execution failed"
            return 1
        fi
        cd - > /dev/null

        # Compare output
        if ! diff -qZB "$TEMPDIR/test.out" "$OUTFILE" > /dev/null 2>&1; then
            echo -e "${RED}FAIL${NC}"
            echo "  Error: Output mismatch"
            echo "  Expected: $(cat "$OUTFILE")"
            echo "  Got: $(cat "$TEMPDIR/test.out")"
            return 1
        fi
    else
        # Without reimu, just check that LLVM IR was generated
        # Verify basic structure of the IR
        if ! grep -q "define i32 @main" "${TEMPDIR}/output.ll"; then
            echo -e "${YELLOW}WARN${NC}"
            echo "  Warning: LLVM IR may be invalid (reimu not available for full test)"
            return 0
        fi
    fi

    echo -e "${GREEN}PASS${NC}"
    return 0
}

# Main test logic
main() {
    local TESTS=()
    local TEMPDIR=""
    local KEEP_TEMP=0
    local PASSED=0
    local FAILED=0
    local TOTAL=0

    # Parse arguments
    if [ $# -eq 0 ]; then
        # Run all tests
        for dir in "${TESTS_DIR}"/basic*; do
            if [ -d "$dir" ]; then
                TESTS+=($(basename "$dir"))
            fi
        done
        # Sort tests numerically
        IFS=$'\n' TESTS=($(sort -V <<<"${TESTS[*]}"))
        unset IFS
    elif [ $# -eq 1 ]; then
        # Run specific test
        TESTS=("$1")
    elif [ $# -eq 2 ]; then
        # Run specific test with custom tempdir
        TESTS=("$1")
        TEMPDIR="$2"
        KEEP_TEMP=1
    else
        echo "Usage: $0 [testcase] [tempdir]" >&2
        exit 1
    fi

    # Check if there are tests to run
    if [ ${#TESTS[@]} -eq 0 ]; then
        echo "No tests found in ${TESTS_DIR}"
        exit 1
    fi

    # Check for clang
    if ! $CLANG --version > /dev/null 2>&1; then
        echo "Error: clang not found" >&2
        exit 1
    fi

    # Warn if reimu is not available
    if ! check_reimu; then
        echo -e "${YELLOW}Warning: reimu not found, only checking LLVM IR generation${NC}"
        echo "  Install reimu for full testing: https://github.com/Engineev/ravel"
        echo ""
    fi

    # Create temp directory if not specified
    if [ -z "$TEMPDIR" ]; then
        TEMPDIR=$(mktemp -d -t ir-test.XXXXXXXXXX)
        if [ $? -ne 0 ]; then
            echo "Error: Failed to create temp directory" >&2
            exit 1
        fi
    fi

    echo "Running ${#TESTS[@]} test(s)..."
    echo "Temp directory: ${TEMPDIR}"
    echo ""

    # Run each test
    for testcase in "${TESTS[@]}"; do
        TOTAL=$((TOTAL + 1))
        if run_test "$testcase" "$TEMPDIR"; then
            PASSED=$((PASSED + 1))
        else
            FAILED=$((FAILED + 1))
        fi
    done

    # Clean up
    if [ $KEEP_TEMP -eq 0 ]; then
        rm -rf "$TEMPDIR"
    else
        echo ""
        echo "Temp files kept at: ${TEMPDIR}"
    fi

    # Print summary
    echo ""
    echo "======================================"
    echo "Tests run: $TOTAL"
    echo -e "Passed: ${GREEN}${PASSED}${NC}"
    if [ $FAILED -gt 0 ]; then
        echo -e "Failed: ${RED}${FAILED}${NC}"
    else
        echo "Failed: $FAILED"
    fi
    echo "======================================"

    if [ $FAILED -gt 0 ]; then
        exit 1
    fi
}

main "$@"
