import { BlobService } from "azure-storage";

import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";

import { upsertBlobFromText } from "@pagopa/io-functions-commons/dist/src/utils/azure_storage";

/**
 * Store text content into blob strorage
 */
export const exportTextToBlob = (
  blobService: BlobService,
  containerName: string
) => (fileName: string) => (
  textContent: string
): TE.TaskEither<Error, BlobService.BlobResult> =>
  pipe(
    TE.tryCatch(
      () =>
        upsertBlobFromText(blobService, containerName, fileName, textContent),
      E.toError
    ),
    TE.chain(TE.fromEither),
    TE.chain(
      O.fold(
        () => TE.left(Error("blob not created")),
        _ => TE.right(_)
      )
    )
  );
