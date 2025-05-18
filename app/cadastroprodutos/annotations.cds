using ShopService as service from '../../srv/services';
annotate service.Produtos with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : '{i18n>Nome}',
                Value : nome,
            },
            {
                $Type : 'UI.DataField',
                Label : '{i18n>Preco}',
                Value : preco,
            },
            {
                $Type : 'UI.DataField',
                Label : '{i18n>Estoque}',
                Value : estoque,
            },
            {
                $Type : 'UI.DataField',
                Label : '{i18n>Descricao}',
                Value : descricao,
            },
            {
                $Type : 'UI.DataField',
                Label : '{i18n>Imagemurl}',
                Value : imagemURL,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : '{i18n>CadastreSeuProduto}',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.HeaderInfo : {
        TypeName : '{i18n>CadastroProduto}',
        TypeNamePlural : '{i18n>CadastroProdutos}',
        Title : {
            $Type : 'UI.DataField',
            Value : '{i18n>Titulo}',
        },
        Description : {
            $Type : 'UI.DataField',
            Value : '{i18n>OsMelhoresProdutosDo}',
        },
        TypeImageUrl : 'sap-icon://retail-store',
    },
    UI.UpdateHidden : true,
    UI.DeleteHidden : true,
    UI.PresentationVariant #vh_Produtos_estoque : {
        $Type : 'UI.PresentationVariantType',
        SortOrder : [
            {
                $Type : 'Common.SortOrderType',
                Property : estoque,
                Descending : false,
            },
        ],
    },
    UI.Identification : [
        {
            $Type : 'UI.DataFieldForAction',
            Action : 'ShopService.EntityContainer/loginCliente',
            Label : '{i18n>Logincliente}',
        },
    ],
);

annotate service.Produtos with {
    nome @Common.FieldControl : #Mandatory
};

annotate service.Produtos with {
    descricao @(
        UI.MultiLineText : true,
        Common.FieldControl : #Optional,
    )
};

annotate service.Produtos with {
    preco @(
        Common.FieldControl : #Mandatory,
        Measures.ISOCurrency : 'BRL',
    )
};

annotate service.Produtos with {
    estoque @(Common.Text : nome,
        Common.FieldControl : #Mandatory,
        Measures.Unit : 'Quantidade',
)};

annotate service.Produtos with {
    imagemURL @(
        Common.FieldControl : #Optional,
        )
};

