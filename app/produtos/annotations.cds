using ShopService as service from '../../srv/services';
annotate service.Produtos with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : '{i18n>nome}',
                Value : nome,
            },
            {
                $Type : 'UI.DataField',
                Label : '{i18n>descricao}',
                Value : descricao,
            },
            {
                $Type : 'UI.DataField',
                Label : '{i18n>preco}',
                Value : preco,
            },
            {
                $Type : 'UI.DataField',
                Label : '{i18n>estoque}',
                Value : estoque,
            },
            {
                $Type : 'UI.DataField',
                Label : '{i18n>imagem}',
                Value : imagemURL,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : '{i18n>imagem}',
            Value : imagemURL,
        },
        {
            $Type : 'UI.DataField',
            Label : '{i18n>nome}',
            Value : nome,
        },
        {
            $Type : 'UI.DataField',
            Label : '{i18n>descricao}',
            Value : descricao,
        },
        {
            $Type : 'UI.DataField',
            Label : '{i18n>preco}',
            Value : preco,
        },
        {
            $Type : 'UI.DataField',
            Label : '{i18n>estoque}',
            Value : estoque,
        },
    ],
    UI.HeaderInfo : {
        TypeName : '{i18n>CadastroProduto}',
        TypeNamePlural : '{i18n>CadastroProdutos}',
        Title : {
            $Type : 'UI.DataField',
            Value : nome,
        },
        ImageUrl : imagemURL,
        TypeImageUrl : '',
    },
);

