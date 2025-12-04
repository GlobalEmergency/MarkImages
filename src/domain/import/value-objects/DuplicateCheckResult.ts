/**
 * Value Object: Resultado de la verificación de duplicados
 * Capa de Dominio
 */

export interface DuplicateMatch {
  aedId: string;
  name: string;
  address: string;
  similarity: number; // 0-1 (1 = coincidencia exacta) - DEPRECATED: usar score
  score?: number; // 0-100 puntos (sistema de scoring)
  createdAt: Date;
}

export class DuplicateCheckResult {
  private constructor(
    private readonly _isDuplicate: boolean,
    private readonly _isPossibleDuplicate: boolean,
    private readonly _matches: DuplicateMatch[],
    private readonly _checkedName: string,
    private readonly _checkedAddress: string
  ) {}

  static noDuplicate(checkedName: string, checkedAddress: string): DuplicateCheckResult {
    return new DuplicateCheckResult(false, false, [], checkedName, checkedAddress);
  }

  static foundDuplicate(
    checkedName: string,
    checkedAddress: string,
    matches: DuplicateMatch[]
  ): DuplicateCheckResult {
    if (matches.length === 0) {
      throw new Error("Cannot create duplicate result without matches");
    }
    return new DuplicateCheckResult(true, false, matches, checkedName, checkedAddress);
  }

  static foundPossibleDuplicate(
    checkedName: string,
    checkedAddress: string,
    matches: DuplicateMatch[]
  ): DuplicateCheckResult {
    if (matches.length === 0) {
      throw new Error("Cannot create possible duplicate result without matches");
    }
    return new DuplicateCheckResult(false, true, matches, checkedName, checkedAddress);
  }

  get isDuplicate(): boolean {
    return this._isDuplicate;
  }

  get isPossibleDuplicate(): boolean {
    return this._isPossibleDuplicate;
  }

  get matches(): DuplicateMatch[] {
    return [...this._matches];
  }

  get checkedName(): string {
    return this._checkedName;
  }

  get checkedAddress(): string {
    return this._checkedAddress;
  }

  get bestMatch(): DuplicateMatch | null {
    if (this._matches.length === 0) return null;
    // Retornar el match con mayor similitud/score
    return this._matches.reduce((best, current) => {
      const currentValue = current.score ?? current.similarity;
      const bestValue = best.score ?? best.similarity;
      return currentValue > bestValue ? current : best;
    });
  }

  toErrorMessage(): string {
    if (!this._isDuplicate) return "";

    const best = this.bestMatch!;
    return `Duplicado detectado: Ya existe un DEA con nombre "${best.name}" y dirección "${best.address}" (ID: ${best.aedId}, registrado el ${best.createdAt.toLocaleDateString()})`;
  }

  toWarningMessage(): string {
    if (!this._isPossibleDuplicate) return "";

    const best = this.bestMatch!;
    const score = best.score ?? Math.round(best.similarity * 100);
    return `Posible duplicado detectado: Similar a "${best.name}" en "${best.address}" (score: ${score}/100). Requiere revisión manual.`;
  }

  toJSON(): Record<string, any> {
    return {
      isDuplicate: this._isDuplicate,
      isPossibleDuplicate: this._isPossibleDuplicate,
      checkedName: this._checkedName,
      checkedAddress: this._checkedAddress,
      matches: this._matches,
      bestMatch: this.bestMatch,
    };
  }
}
