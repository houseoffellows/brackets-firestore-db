import * as rfdc from 'rfdc';
import { CrudInterface, OmitId, Table, Database, DataTypes } from 'brackets-manager';
import {firestore} from "firebase-admin";
import Firestore = firestore.Firestore;

const clone = rfdc();
const dataTable = 'bracketData';

export class FirestoreDatabase implements CrudInterface {
    protected data: Database = {
        participant: [],
        stage: [],
        group: [],
        round: [],
        match: [],
        match_game: [],
    };

    private client: Firestore;
    private stageNumber: string;

    constructor(client: Firestore, stageNumber: string) {
        this.client = client;
        this.stageNumber = stageNumber;

        this.init();
    }

    private async updateDb(): Promise<void> {
        const bracketDataCollection = this.client.collection(dataTable)

        if (!this.data) {
            return;
        }

        console.log('Updating DB');

        //if (this.data.participant.length === 0) {

        bracketDataCollection.doc(this.stageNumber).set({
            stageNumber: parseInt(this.stageNumber),
            //...this.data,
            raw: JSON.stringify(this.data)
        }, { merge: false }).then()
    }

    /**
     * Initiates the storage.
     */
    private init(): void {
        if (!this.stageNumber) {
            return;
        }

        // Fetch existing data, if any
        const bracketDataCollection = this.client.collection(dataTable)

        bracketDataCollection.doc(this.stageNumber).get().then((doc) => {
                if (doc.exists) {
                    const data = doc.data()
                    // Set initial data
                    this.data = JSON.parse(data!.raw) as Database
                } else {
                    // Create a document since it doesn't exist.
                    bracketDataCollection.doc(this.stageNumber).set({
                        stageNumber: this.stageNumber,
                        raw: JSON.stringify(this.data)
                        //...this.data - This triggers an error in Firestore. Objects with null-values fails.
                    }, { merge: false }).then()
                }
            })
    }

    /**
     * @param data "import" data from external
     */
    setData(data: Database): void {
        this.data = data;
    }

    /**
     * @param partial Filter
     */
    makeFilter(partial: any): (entry: any) => boolean {
        return (entry: any): boolean => {
            let result = true;
            for (const key of Object.keys(partial))
                result = result && entry[key] === partial[key];

            return result;
        };
    }

    /**
     * Clearing all the data
     */
    reset(): void {
        this.data = {
            participant: [],
            stage: [],
            group: [],
            round: [],
            match: [],
            match_game: [],
        };
    }

    insert<T>(table: Table, value: OmitId<T>): Promise<number>;
    /**
     * Inserts multiple values in the database.
     *
     * @param table Where to insert.
     * @param values What to insert.
     */
    insert<T>(table: Table, values: OmitId<T>[]): Promise<boolean>;

    /**
     * Implementation of insert
     *
     * @param table Where to insert.
     * @param values What to insert.
     */
    insert<T>(
        table: Table,
        values: OmitId<T> | OmitId<T>[],
    ): Promise<number> | Promise<boolean> {
        let id = this.data[table].length > 0
            // @ts-ignore
            ? (Math.max(...this.data[table].map(d => d.id)) + 1)
            : 0;

        if (!Array.isArray(values)) {
            try {
                // @ts-ignore
                this.data[table].push({ id, ...values });
            } catch (error) {
                return new Promise<number>((resolve) => {
                    resolve(-1);
                });
            }
            return new Promise<number>((resolve) => {
                this.updateDb().then(() => resolve(id));
            });
        }

        try {
            values.map((object) => {
                // @ts-ignore
                this.data[table].push({ id: id++, ...object });
            });
        } catch (error) {
            return new Promise<boolean>((resolve) => {
                resolve(false);
            });
        }

        return new Promise<boolean>((resolve) => {
            this.updateDb().then(() => resolve(true));
        });
    }

    /**
     * Gets all data from a table in the database.
     *
     * @param table Where to get from.
     */
    select<T>(table: Table): Promise<T[] | null>;
    /**
     * Gets specific data from a table in the database.
     *
     * @param table Where to get from.
     * @param id What to get.
     */
    select<T>(table: Table, id: number): Promise<T | null>;
    /**
     * Gets data from a table in the database with a filter.
     *
     * @param table Where to get from.
     * @param filter An object to filter data.
     */
    select<T>(table: Table, filter: Partial<T>): Promise<T[] | null>;

    /**
     * @param table Where to get from.
     * @param arg Arg.
     */
    select<T>(table: Table, arg?: number | Partial<T>): Promise<T[] | null> {
        try {
            if (arg === undefined) {
                return new Promise<T[]>((resolve) => {
                    // @ts-ignore
                    resolve(this.data[table].map(clone));
                });
            }

            if (typeof arg === 'number') {
                return new Promise<T[]>((resolve) => {
                    // @ts-ignore
                    resolve(clone(this.data[table].find(d => d.id === arg)));
                });
            }

            return new Promise<T[] | null>((resolve) => {
                // @ts-ignore
                resolve(this.data[table].filter(this.makeFilter(arg)).map(clone));
            });
        } catch (error) {
            return new Promise<null>((resolve) => {
                resolve(null);
            });
        }
    }

    /**
     * Updates data in a table.
     *
     * @param table Where to update.
     * @param id What to update.
     * @param value How to update.
     */

    update<T>(table: Table, id: number, value: T): Promise<boolean>;

    /**
     * Updates data in a table.
     *
     * @param table Where to update.
     * @param filter An object to filter data.
     * @param value How to update.
     */
    update<T>(
        table: Table,
        filter: Partial<T>,
        value: Partial<T>
    ): Promise<boolean>;

    /**
     * Updates data in a table.
     *
     * @param table Where to update.
     * @param arg
     * @param value How to update.
     */
    update<T>(
        table: Table,
        arg: number | Partial<T>,
        value?: Partial<T>,
    ): Promise<boolean> {
        console.log('Type is number: ' + typeof arg === 'number' ? 'yes' : 'no');
        if (typeof arg === 'number') {
            try {
                // @ts-ignore
                this.data[table][arg] = value;
                return new Promise<boolean>((resolve) => {
                    this.updateDb().then(() => resolve(true));
                });
            } catch (error) {
                return new Promise<boolean>((resolve) => {
                    resolve(false);
                });
            }
        }

        // @ts-ignore
        const values = this.data[table].filter(this.makeFilter(arg));
        if (!values) {
            return new Promise<boolean>((resolve) => {
                resolve(false);
            });
        }

        values.forEach((v: { id: any }) => {
            const existing = this.data[table][v.id];
            for (const key in value) {
                // @ts-ignore
                if (existing[key] && typeof existing[key] === 'object' && typeof value[key] === 'object') {
                    // @ts-ignore
                    Object.assign(existing[key], value[key]); // For opponent objects, this does a deep merge of level 2.
                } else {
                    // @ts-ignore
                    existing[key] = value[key]; // Otherwise, do a simple value assignment.
                }
            }
            this.data[table][v.id] = existing;
        });

        return new Promise<boolean>((resolve) => {
            this.updateDb().then(() => resolve(true));
        });
    }

    /**
     * Empties a table completely.
     *
     * @param table Where to delete everything.
     */
    delete(table: Table): Promise<boolean>;
    /**
     * Delete data in a table, based on a filter.
     *
     * @param table Where to delete in.
     * @param filter An object to filter data.
     */
    delete<T>(table: Table, filter: Partial<T>): Promise<boolean>;

    /**
     * Delete data in a table, based on a filter.
     *
     * @param table Where to delete in.
     * @param filter An object to filter data.
     */
    delete<T>(table: Table, filter?: Partial<T>): Promise<boolean> {
        const values = this.data[table];
        if (!values) {
            return new Promise<boolean>((resolve) => {
                resolve(false);
            });
        }

        if (!filter) {
            this.data[table] = [];

            return new Promise<boolean>((resolve) => {
                resolve(true);
            });
        }

        const predicate = this.makeFilter(filter);
        const negativeFilter = (value: any): boolean => !predicate(value);

        // @ts-ignore
        this.data[table] = values.filter(negativeFilter);


        return new Promise<boolean>((resolve) => {
            console.log('Call #5');
            this.updateDb().then(() => resolve(true));
        });
    }
}
