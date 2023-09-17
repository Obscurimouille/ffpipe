import 'reflect-metadata';
import { ClassTransformService } from "../../services/plain-to-class/plain-to-class.service";
import { ValidationError, isNumber } from 'class-validator';
import { PipelineDTO } from '../dtos/models/pipeline-dto';
import { InstructionArgsDTO } from '../dtos/models/args-dto';
import { PipelineParserService } from '../../services/pipeline/pipeline-parser.service';
import { logger, pipelineParserLogger } from '../../logger';
import { StepDTO } from '../dtos/models/step-dto';

type ErrorCallback = (message: string) => void;

export class PipelineParser {

    private parserService: PipelineParserService;
    private _inputPipeline: string;

    constructor(pipeline: string) {
        this._inputPipeline = pipeline;
        this.parserService = PipelineParserService.getInstance();
    }

    public async run(fail: ErrorCallback = () => {}): Promise<PipelineDTO> {
        // Parse the JSON input pipeline
        const json = this.parseInputPipeline();

        // Instanciate and validate pipeline DTO (without detailed instructions and statements)
        const pipelineDTO = ClassTransformService.plainToClass(PipelineDTO, json!);
        await ClassTransformService.validate(pipelineDTO, this.handleValidationErrors);

        // Reset the list of ids to validate
        this.parserService.resetValidatedIds();

        return pipelineDTO;
    }

    private handleValidationErrors(errors: ValidationError[]) {
        for (const error of errors) {
            pipelineParserLogger.error(PipelineParser.formatValidationError(error));
        }
        process.exit(1);
    }

    private parseInputPipeline(): object {
        let model;

        try {
            model = JSON.parse(this._inputPipeline) as object;
            if (!model) throw new Error();
        }
        catch (error) {
            throw new Error('Pipeline file is not valid JSON');
        }

        return model;
    }

    /**
     * Format a validation error.
     * @param error The validation error to format.
     * @returns The formatted validation error.
     */
    private static formatValidationError(error: ValidationError): string {
        let content = ``;

        if (error.value && !Array.isArray(error.value)) {
            if (error.value instanceof StepDTO) {
                const id = error.value.id;
                if (id && isNumber(id)) content += `> Step ${id}:\n`;
                else content += `> Step:\n`;
            }
        }

        if (error.children && error.children.length > 0) {
            for (const child of error.children) {
                content += this.formatValidationError(child);
            }
        }
        else {
            for (const constraint in error.constraints) {
                const message = error.constraints[constraint];
                if (error.target instanceof InstructionArgsDTO) {
                    content += `  - arguments: ${message}\n`;
                }
                else content += `  - ${message}\n`;
            }
        }
        return content;
    }

}