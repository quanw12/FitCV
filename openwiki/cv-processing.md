---
type: system
title: CV Processing & Analysis Pipeline
description: End-to-end CV processing pipeline including file upload, text extraction, parsing, analysis, matching, and improvement generation.
tags: [cv-processing, ai, nlp, document-processing, matching]
---
# CV Processing & Analysis Pipeline

## Overview
FitCV's CV processing pipeline handles the complete lifecycle of CV documents from upload through analysis, job matching, and improvement generation. The pipeline uses AI-powered text extraction, semantic parsing, and matching algorithms to evaluate candidate-job fit.

## Core Components

### Backend Routes
- **Analyzer Routes**: `/backend/app/api/routes/analyzer.py` - CV upload, parsing, and analysis endpoints
- **CV Rebuild Routes**: `/backend/app/api/routes/cv_rebuild.py` - CV regeneration and improvement application
- **CV Ranking Routes**: `/backend/app/api/routes/cv_ranking.py` - Ranking CVs against jobs
- **Improvement Routes**: `/backend/app/api/routes/improvements.py` - CV improvement suggestion management

### Services
- **Analyzer Service**: `/backend/app/services/analyzer_service.py` - Orchestrates CV processing workflow
- **Match Engine**: `/backend/app/services/match_engine.py` - Core matching algorithm implementation
- **Matching Service**: `/backend/app/services/matching_service.py` - High-level matching operations
- **Document Parser**: `/backend/app/services/document_parser.py` - Text extraction from PDF/DOCX
- **CV Rebuild Service**: `/backend/app/services/cv_rebuild/` - CV regeneration and improvement application (includes modules for avatar, completeness, grounding, improvement applier, language, LLM extraction, normalization, orchestration, PDF rendering, prompts, and template rendering)
- **Gemini Analyzer**: `/backend/app/services/gemini_analyzer.py` - AI-powered CV analysis using Google Gemini
- **Improvement Service**: `/backend/app/services/improvement_service.py` - Generates and manages improvement suggestions
- **OCR Service**: `/backend/app/services/ocr_service.py` - Optical character recognition for scanned documents
- **FreeHire Job Search**: `/backend/app/services/freehire_job_search.py` - External job search integration
- **LinkedIn Job Search**: `/backend/app/services/linkedin_job_search.py` - LinkedIn job scraping
- **Job Extraction Service**: `/backend/app/services/job_extraction_service.py` - Extracts job details from text

### Workers & Background Processing
- **AI Worker**: `/backend/app/services/ai_worker.py` - Background worker for AI-intensive tasks
- **AI Tasks Routes**: `/backend/app/api/routes/ai_tasks.py` - Manage background AI operations
- **Worker**: `/backend/app/worker.py` - Celery/RQ style worker setup

### Frontend Components
- **Analyzer Screen**: `/src/ui/screens/AnalyzerScreen.tsx` - CV upload and analysis interface
- **CV Rebuild Screen**: `/src/ui/screens/CVReBuildScreen.tsx` - CV improvement and regeneration
- **Improvement Screen**: `/src/ui/screens/ImprovementScreen.tsx` - View and apply CV suggestions
- **CV Ranking Screen**: `/src/ui/screens/CVRankingScreen.tsx` - View CV-job match results

## Processing Pipeline Stages

### Stage 1: CV Upload & Initial Processing
1. **File Upload**: User uploads PDF or DOCX CV via Analyzer Screen
2. **Validation**: File type, size, and virus scanning (if implemented)
3. **Storage**: File saved to `/backend/uploads/` with metadata recorded in `cv` table
4. **Hash Generation**: SHA256 hash computed for integrity verification
5. **Database Record**: Creates `cv` entry with `is_latest = true`, increments version number

### Stage 2: Text Extraction & Parsing
1. **Document Parsing**: 
   - PDF: Uses pdfplumber/pymupdf for text extraction
   - DOCX: Uses python-docx for text and structure extraction
   - OCR Fallback: OCR service for scanned/image-based PDFs
2. **Raw Text Storage**: Extracted text stored in `cv_parse_result.parsed_text`
3. **AI Parsing**: 
   - Raw text sent to Gemini AI for structured parsing
   - Returns JSON with structured CV data (skills, experience, education, etc.)
   - Stored in `cv_parse_result.parsed_json`
4. **Status Tracking**: Parse status updated in `cv_parse_result` (Pending → Processing → Success/Failed)

### Stage 3: Analysis & Matching Preparation
1. **CV Analysis**: 
   - Structured data analyzed for completeness, relevance, and quality
   - Skill extraction and normalization
   - Experience duration calculation
   - Education level assessment
2. **Feature Engineering**: 
   - Text embeddings generated for semantic matching
   - Skill taxonomy mapping
   - Experience level classification
3. **Storage**: Analysis results cached for quick retrieval

### Stage 4: Job Matching (When Job/JD Provided)
1. **Job Processing**: 
   - Similar parsing pipeline for job descriptions (if not already processed)
   - Job description stored in `job_description` table
   - Parsed JSON stored in `jd_parse_result`
2. **Matching Algorithm**:
   - **Skills Matching**: Compares CV skills to job requirements using weighted similarity
   - **Experience Matching**: Evaluates relevant experience duration and level
   - **Education Matching**: Compares educational background to job requirements
   - **Soft Skill Matching**: Assesses communication, leadership, etc. from CV content
   - **Weighted Scoring**: Uses job-defined weights (skill_weight, experience_weight, etc.)
3. **Result Generation**:
   - Overall score (0-100) calculated from weighted category scores
   - Pass probability estimation
   - Match label (e.g., "Strong Match", "Moderate Match", "Weak Match")
   - Evidence JSON highlighting matching/missing elements
   - Strengths and weaknesses analysis
   - Stored in `match_result` table

### Stage 5: Improvement Generation
1. **Trigger**: Match result or user request for CV improvement
2. **Gap Analysis**: 
   - Compares CV to job requirements
   - Identifies missing skills, experience gaps, format issues
3. **Suggestion Generation**:
   - **SkillGap**: Suggests acquiring specific missing skills
   - **SectionFeedback**: Provides feedback on CV sections (summary, experience, etc.)
   - **Rewrite**: Offers rewritten versions of weak sections
   - **QuickWin**: Suggests easy improvements (formatting, keywords, etc.)
4. **Prioritization**: 
   - Priority levels (Low/Medium/High) based on impact and effort
   - Sort order for presentation
5. **Storage**: Suggestions stored in `cv_improvement_suggestion` linked to match result

### Stage 6: CV Rebuild & Regeneration
1. **Template Selection**: User chooses CV template or uses existing
2. **Content Generation**:
   - Applies accepted improvement suggestions
   - Rewrites sections using AI while preserving truthfulness
   - Optimizes for ATS (Applicant Tracking Systems)
   - Ensures keyword matching for target jobs
3. **Output Generation**:
   - Generates new PDF/DOCX CV
   - Updates `cv` table with new version
   - Sets previous version to `is_latest = false`
   - Maintains version history

## Data Flow & Relationships

### Core Entities Relationship
```
CV Upload → cv table
           � ↓
Text Extraction → cv_parse_result (parsed_text, parsed_json)
           � ↓
AI Analysis → Enhanced parsed_json with structured data
           � ↓
Job Matching → match_result (scores, labels, evidence)
           � ↓
Improvement Gen → cv_improvement_suggestion (suggestions)
           � ↓
CV Rebuild → New cv entry (incremented version)
```

### Supporting Entities
- **Job Processing**: Parallel pipeline for job descriptions
- **Applications**: Link CVs to specific job applications via `application` table
- **Tracking**: External application tracking in `tracked_application` table
- **Screening**: Batch HR screening in `hr_screening_batch` and `hr_screening_candidate`

## Key Algorithms & Techniques

### Text Extraction
- **PDF**: pdfplumber with layout preservation, fallback to pymupdf
- **DOCX**: python-docx for text and basic structure
- **OCR**: Tesseract or Google Vision API for scanned documents
- **Text Cleaning**: Noise removal, encoding normalization, whitespace standardization

### AI Parsing (Gemini)
- **Prompt Engineering**: Structured prompts for consistent JSON output
- **Schema Validation**: Pydantic models validate AI responses
- **Error Handling**: Retry logic, fallback parsing, error messaging
- **Token Management**: Efficient prompt design to minimize API usage

### Matching Algorithm
- **Skill Matching**: 
  - Taxonomy-based skill normalization
  - Semantic similarity using embeddings
  - Proficiency level inference from context
- **Experience Matching**:
  - Date parsing and duration calculation
  - Relevance scoring based on job requirements
  - Level matching (entry, mid, senior, etc.)
- **Education Matching**:
  - Degree level comparison
  - Field of study relevance
  - Institution quality indicators (if available)
- **Soft Skill Inference**:
  - Language analysis for communication indicators
  - Leadership keywords and context
  - Teamwork and collaboration evidence
- **Scoring**:
  - Normalized category scores (0-100)
  - Weighted average using job-defined weights
  - Pass probability logistic regression (if implemented)

### Improvement Generation
- **Rule-Based**: Specific gaps trigger specific suggestion types
- **Template-Based**: Pre-defined improvement templates customized to context
- **AI-Generated**: Custom suggestions using LLM for unique situations
- **Evidence-Based**: Suggestions linked to specific CV/job mismatches

## Focused Tests

### Backend Tests (`/backend/tests/`)
- **Analyzer Service Tests**: 
  - File type validation
  - Text extraction accuracy
  - AI parsing integration
  - Error handling for corrupt files
- **Match Engine Tests**:
  - Skill matching accuracy
  - Experience calculation correctness
  - Weighted scoring validation
  - Edge case handling (missing data)
- **Matching Service Tests**:
  - End-to-end matching workflow
  - Result storage and retrieval
  - Performance with large datasets
- **Improvement Service Tests**:
  - Suggestion generation relevance
  - Prioritization logic
  - Template application correctness
- **CV Rebuild Tests**:
  - Template application accuracy
  - Content preservation
  - ATS optimization checks
  - File generation integrity

### Frontend Tests
- **Analyzer Screen Tests**:
  - File upload handling
  - Upload progress indication
  - Error state management
  - Analysis result display
- **CV Rebuild Tests**:
  - Suggestion acceptance/rejection
  - Template selection
  - Preview generation
  - Download functionality
- **Improvement Screen Tests**:
  - Suggestion listing and filtering
  - Detail view interaction
  - Application workflow

## Validation Commands

### Backend Pipeline Tests
```bash
# From backend directory
# Test analyzer service
pytest -xvs backend/tests/test_analyzer_service.py

# Test matching service
pytest -xvs backend/tests/test_matching_service.py

# Test improvement service
pytest -xvs backend/tests/test_improvement_service.py

# Test CV rebuild service
pytest -xvs backend/tests/test_cv_rebuild/*

# Test document parser
pytest -xvs backend/tests/test_document_parser.py
```

### Frontend Pipeline Tests
```bash
# From root directory
# Test analyzer screen
npm test -- src/ui/screens/AnalyzerScreen.test.tsx

# Test CV rebuild screen
npm test -- src/ui/screens/CVReBuildScreen.test.tsx

# Test improvement screen
npm test -- src/ui/screens/ImprovementScreen.test.tsx
```

### Manual Validation
```bash
# Test CV upload endpoint (requires auth)
curl -X POST "http://localhost:8000/analyzer/upload-cv" \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@/path/to/sample.pdf"

# Test matching endpoint
curl -X POST "http://localhost:8000/analyzer/match" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"cv_id": 123, "job_id": 456}'

# Test improvement generation
curl -X POST "http://localhost:8000/improvements/generate" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"match_result_id": 789}'
```

## Change Navigation

### Adding New File Format Support
1. Update file validation in `/backend/app/api/routes/analyzer.py`
2. Add parser implementation in `/backend/app/services/document_parser.py`
3. Update CV model if new metadata needed
4. Add specific handling in analyzer service workflow
5. Update frontend file acceptance in AnalyzerScreen
6. Add tests for new format parsing
7. Update documentation and file type constants

### Modifying Matching Algorithm
1. Identify which matching component needs change (skills, experience, etc.)
2. Modify corresponding function in `/backend/app/services/match_engine.py`
3. Update weight handling if changing score calculation
4. Add/update test cases in matching service tests
5. Consider impact on existing match results (may need recomputation)
6. Update any caching mechanisms if applicable
7. Update frontend display if score interpretation changes

### Adding New Suggestion Types
1. Extend `SuggestionType` ENUM in `/backend/app/schemas/improvement.py`
2. Add handling in improvement service generation logic
3. Create template or generation logic for new type
4. Update frontend to display new suggestion type appropriately
5. Add database migration if new fields needed in suggestion table
6. Add unit tests for new suggestion generation
7. Update improvement provider/service interfaces if needed

### Changing AI Models/Prompts
1. Update Gemini client configuration in `/backend/app/services/gemini_client.py`
2. Modify prompts in `/backend/app/services/cv_rebuild/prompts.py` or analyzer service
3. Test output quality and format consistency
4. Update token usage calculations if model changes
5. Add A/B testing framework if evaluating new models
6. Update any response parsing logic
7. Test with diverse CV/job samples to ensure robustness

### Performance Optimizations
1. Add caching for frequent operations (CV parsing, common skills)
2. Implement batch processing for multiple CVs
3. Add async processing for non-critical steps
4. Optimize database queries with proper indexing
5. Consider vector databases for semantic search at scale
6. Implement request queuing for AI API rate limits
7. Add monitoring and metrics for pipeline stages

### Frontend Updates
1. Modify API calls in `/src/services/` if backend endpoints change
2. Update TypeScript types in `/src/types/` for new data structures
3. Adjust UI components in `/src/ui/screens/` for new data display
4. Update state management if new processing states added
5. Modify API service layer in `/src/api/` for new endpoints
6. Update test mocks and expectations
7. Consider user experience implications of changes

## Related Systems
- **Database**: All processing data stored in tables defined in `/database/full_schema.sql`
- **Authentication**: Users must be authenticated to access processing features
- **Job Management**: Jobs and JDs processed through similar pipeline for matching
- **Application System**: Match results inform application decisions and tracking
- **HR Functionality**: Batch screening uses same processing pipeline for multiple CVs
- **Background Workers**: AI-intensive tasks offloaded to worker service
- **Email System**: Improvement notifications and CV updates can trigger emails
- **Reports**: Processing analytics and matching statistics feed into reports system

## Change Impact Summary
- **High Impact**: Changes to core parsing, matching, or improvement generation algorithms
- **Medium Impact**: Changes to file handling, storage, or API endpoints
- **Low Impact**: UI tweaks, minor text changes, non-core feature additions
- **Breaking Changes**: Altering database schemas for core tables requires migration
- **Performance Sensitive**: AI service calls, text processing, matching algorithms
- **Testing Critical**: All changes require comprehensive test coverage due to AI variability
