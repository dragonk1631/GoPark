# GNU Go WASM 엔진 디버깅 및 연동 보고서

## 1. 프로젝트 개요
본 프로젝트는 웹 브라우저 환경에서 GNU Go AI 엔진을 WASM(WebAssembly)으로 구동하여 사용자에게 바둑 대국 및 코칭 기능을 제공하는 것을 목표로 합니다.

## 2. 주요 문제점 및 원인 분석

### Error: "Empty file?" on FS.writeFile
- **Cause**: Emscripten might have issues writing to the virtual root if the WASM build has a different FS setup.
- **Investigation**:
    - Checked if `/` is writable.
    - Attempted to use a subdirectory like `/tmp/`.
    - Investigated if `patterns.dat` is actually needed (GNU Go often works with default patterns).

### Error: "Read-only property ___emscripten_environ_constructor"
- **Cause**: Emscripten's runtime attempting to overwrite global properties that are marked as read-only by the browser (often occurs with ESM modules or certain Vite configurations).
- **Resolution**: Commented out the assertion wrappers in `gnugo.js` and reverted to traditional worker loading.

## Current Fixes Applied
- **gnugo.js**: Patched assertion wrappers (lines 5373-5481).
- **AiEngine.js**: 
    - Reverted to standard `new Worker('/ai-worker.js')`.
    - Increased move generation timeout to 30 seconds.
- **ai-worker.js**:
    - Reverted to `importScripts('/gnugo.js')`.
    - Added comprehensive log clearing and error handling.

## Future Recommendations
- Upgrade the GNU Go Emscripten build to a more modern version that supports ESM natively.
- Optimize the SGF bridge to avoid replaying the entire history every move.

---

## 3. 해결 및 구현 내용

### 3.1. GTP-to-SGF 브릿지 시스템 구축 (`ai-worker.js`)
엔진의 Stateless 특성을 극복하기 위해 Web Worker 내부에 입출력 중계 레이어를 구현했습니다.
- **상태 유지**: 워커 내에서 `moveSequence`(수순)와 `grid`(보드 상태)를 실시간으로 추적합니다.
- **SGF 래핑**: 사용자의 GTP 명령어(`play`, `genmove`)를 엔진이 이해할 수 있는 SGF 형식 문자열로 변환하여 전달합니다.
- **좌표 변환**: GTP 좌표 시스템(A-T, 1-19)과 SGF 좌표 시스템(a-s, a-s) 간의 정밀한 변환 로직을 적용했습니다.

### 3.2. 가상 파일 시스템(VFS) 최적화
- **더미 파일 생성**: 엔진 초기화 시 `/patterns.dat` 경로에 최소 규격의 데이터를 생성하여 로딩 오류를 방지했습니다.
- **Runtime 안전성**: `Module.quit`을 가로채어 엔진이 내부적으로 종료 명령을 내려도 브라우저 환경(Web Worker)이 파괴되지 않도록 보호 처리했습니다.

### 3.3. 보드 동기화 로직 복구
- **`list_stones` 구현**: 프론트엔드에서 현재 돌의 상태를 요청할 때, 워커가 관리하는 보드 그리드 정보를 바탕으로 정확한 돌 목록을 반환하도록 수정했습니다.

---

## 4. 최종 결과
- **정상 작동**: AI가 현재 형세를 정확히 판단하고 유효한 수(예: Q17 등)를 착수합니다.
- **상태 보존**: 대국 진행 중 돌이 사라지지 않으며, 수순이 정확하게 누적됩니다.
- **안정성**: 엔진의 비정상 종료로 인한 Worker 멈춤 현상이 해결되었습니다.

---
**작성일**: 2026-03-12  
**작성자**: Antigravity (Pair Programming AI)
